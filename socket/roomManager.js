// socket/roomManager.js
const { generateRoomId } = require("../utils/helpers");
const config = require("../config");

const activeRooms = new Map(); // roomId -> roomObject
const ROOM_CREATION_GRACE_PERIOD_MS = 7000;
function createRoom(io, socket, userManager, gameType, hostUsername) {
	const user = userManager.getUser(socket.id);
	if (!user || user.username !== hostUsername) {
		// Ensure user exists and username matches if it was pre-set
		// Or, if username is only set on create/join, add user here.
		// For this implementation, addUser is called before createRoom/joinRoom attempts.
		userManager.addUser(socket.id, hostUsername);
	}

	const gameDetails = config.GAME_CONFIG[gameType];
	if (!gameDetails) {
		return { error: true, message: `Invalid game type: ${gameType}` };
	}

	const roomId = generateRoomId();
	const capacity = gameDetails.capacity || config.DEFAULT_ROOM_CAPACITY;
	const minPlayers = gameDetails.minPlayers || config.DEFAULT_MIN_PLAYERS;
	const colorCode = gameDetails.colorCode || config.DEFAULT_MIN_PLAYERS;

	const hostUser = userManager.getUser(socket.id); // Re-fetch in case it was just added
	if (!hostUser) {
		// Should not happen if addUser worked
		return { error: true, message: `Host user not found after creation attempt.` };
	}

	const room = {
		id: roomId,
		name: `${gameDetails.name} Room by ${hostUser.username}`,
		gameType: gameType,
		host: { socketId: socket.id, username: hostUser.username },
		players: [{ socketId: socket.id, username: hostUser.username }],
		capacity: capacity,
		minPlayers: minPlayers,
		colorCode: colorCode,
		gameState: {}, // To be initialized by gameManager
		createdAt: Date.now(),
		status: "waiting", // waiting, ready, in-progress, finished
	};
	activeRooms.set(roomId, room);
	socket.join(roomId);
	userManager.setUserRoom(socket.id, roomId);

	console.log(`Room created: ${roomId} (Type: ${gameType}) by ${hostUser.username}`);
	console.log(activeRooms);
	return { success: true, room };
}

function joinRoom(io, socket, userManager, gameManager, roomId, username) {
	const room = activeRooms.get(roomId);
	if (!room) {
		return { error: true, message: `Room ${roomId} not found.` };
	}

	if (room.players.length >= room.capacity) {
		return { error: true, message: `Room ${roomId} is full.` };
	}

	if (room.status === "in-progress" /* && !gameAllowsJoiningInProgress(room.gameType) */) {
		// Add a check if the game type allows joining while in progress
		return { error: true, message: `Cannot join room ${roomId}, game already in progress.` };
	}

	// Check for duplicate username in the room
	if (room.players.some((player) => player.username === username.trim())) {
		return { error: true, message: `Username "${username}" is already taken in this room.` };
	}

	// Add or update user
	let user = userManager.getUser(socket.id);
	if (!user) {
		user = userManager.addUser(socket.id, username);
	} else if (user.username !== username) {
		// If user exists with different name, this implies a name change attempt during join
		// For simplicity, we'll use the provided username for this room session.
		// A separate 'set_username' event should handle explicit name changes.
		user.username = username.trim(); // Update userManager's record for this socket
	}
	if (!user) return { error: true, message: "Failed to register user." };

	room.players.push({ socketId: socket.id, username: user.username });
	socket.join(roomId);
	userManager.setUserRoom(socket.id, roomId);

	console.log(`User ${user.username} (ID: ${socket.id}) joined room ${roomId}`);

	// Notify room
	io.to(roomId).emit("user_joined", {
		roomId,
		userId: socket.id,
		username: user.username,
		playerCount: room.players.length,
	});
	io.to(roomId).emit("room_update", getRoomInfoForClient(room)); // Send full update

	return { success: true, room };
}

function leaveRoom(io, socket, userManager, roomId) {
	const room = activeRooms.get(roomId);
	const user = userManager.getUser(socket.id);

	if (!room || !user) {
		// If user is null but socket was in a room (e.g. server restart, user obj lost)
		// we might still want to attempt removal from room if room knows socket.id
		if (room && !user) console.warn(`User object not found for socket ${socket.id} leaving room ${roomId}, but room exists. Attempting removal.`);
		else return { error: true, message: `Room or user not found for leave operation.` };
	}

	const username = user ? user.username : `UnknownUser-${socket.id.substring(0, 5)}`; // Fallback username

	// Filter out the player
	const originalPlayerCount = room.players.length;
	room.players = room.players.filter((player) => player.socketId !== socket.id);
	socket.leave(roomId);
	if (user) userManager.clearUserRoom(socket.id); // Clear only if user obj exists

	console.log(`User ${username} (ID: ${socket.id}) left room ${roomId}. Players remaining: ${room.players.length}`);

	// Check if room is now empty
	if (room.players.length === 0) {
		// Grace period for newly created rooms before deletion
		if (Date.now() - room.createdAt < ROOM_CREATION_GRACE_PERIOD_MS) {
			console.log(`Room ${roomId} is empty but was created recently. Setting grace period for host re-connection.`);
			// Mark for potential cleanup if host doesn't re-establish
			if (!room.cleanupTimeout) {
				// Avoid setting multiple timeouts
				room.cleanupTimeout = setTimeout(() => {
					const currentRoom = activeRooms.get(roomId);
					if (currentRoom && currentRoom.players.length === 0) {
						// Still empty
						console.log(`Grace period expired for empty new room ${roomId}. Deleting.`);
						activeRooms.delete(roomId);
						io.emit("room_list_update_needed"); // Signal clients to re-fetch room list
					}
				}, ROOM_CREATION_GRACE_PERIOD_MS + 1000); // Cleanup a bit after grace period
			}
			return { success: true, roomClosed: false, message: "Room empty, awaiting host re-connection." };
		} else {
			activeRooms.delete(roomId);
			console.log(`Room ${roomId} closed as it's empty.`);
			io.emit("room_list_update_needed");
			return { success: true, roomClosed: true };
		}
	}

	// Host migration logic
	let hostChanged = false;
	if (room.host.socketId === socket.id) {
		// If host of a newly created room disconnects, give grace period for re-establishment
		if (Date.now() - room.createdAt < ROOM_CREATION_GRACE_PERIOD_MS) {
			console.log(`Host of new room ${roomId} disconnected. Awaiting re-connection. Current host username: ${room.host.username}`);
			room.host.pendingReconnect = true; // Mark host as expecting re-connection
			// The actual socketId will be updated by 'reestablish_in_room'
		} else {
			const newHostPlayer = room.players[0]; // Promote the next player
			if (newHostPlayer) {
				room.host = { socketId: newHostPlayer.socketId, username: newHostPlayer.username };
				delete room.host.pendingReconnect; // Clear if it was somehow set
				console.log(`Host changed in room ${roomId} to ${newHostPlayer.username}`);
				io.to(roomId).emit("host_changed", {
					roomId,
					newHostSocketId: newHostPlayer.socketId,
					newHostUsername: newHostPlayer.username,
				});
				hostChanged = true;
			} else {
				// This case should be covered by room.players.length === 0, but safeguard
				activeRooms.delete(roomId);
				console.log(`Room ${roomId} closed as host left and no other players (after grace period check).`);
				io.emit("room_list_update_needed");
				return { success: true, roomClosed: true };
			}
		}
	}

	// Notify remaining players
	io.to(roomId).emit("user_left", {
		roomId,
		userId: socket.id,
		username: username, // Use the determined username
		playerCount: room.players.length,
	});
	// Send a full room update if host didn't change, or host change event handles it
	if (!hostChanged) {
		// Avoid double update if host_changed was emitted
		io.to(roomId).emit("room_update", getRoomInfoForClient(room));
	}

	return { success: true, roomClosed: false };
}

function handlePlayerDisconnect(io, socket, userManager, gameManager) {
	const user = userManager.getUser(socket.id);
	if (user && user.currentRoomId) {
		console.log(`Handling disconnect for user ${user.username} in room ${user.currentRoomId}`);
		leaveRoom(io, socket, userManager, user.currentRoomId); // gameManager might be needed if game state needs adjustment
	}
	userManager.removeUser(socket.id);
}

function getRoomInfo(roomId) {
	return activeRooms.get(roomId);
}

// Helper to format room info for client, excluding sensitive or oversized data
function getRoomInfoForClient(room) {
	if (!room) return null;
	return {
		id: room.id,
		name: room.name,
		gameType: room.gameType,
		host: room.host,
		players: room.players.map((p) => ({ socketId: p.socketId, username: p.username })), // Avoid sending full user objects if they contain more
		playerCount: room.players.length,
		capacity: room.capacity,
		colorCode: room.colorCode,
		minPlayers: room.minPlayers,
		status: room.status,
		createdAt: room.createdAt,
		// gameState: room.gameState, // Decide if full gameState is sent with every room_update
	};
}

function getAllActiveRoomsForClient() {
	return Array.from(activeRooms.values()).map(getRoomInfoForClient);
}

function startGame(io, socket, userManager, gameManager, roomId, data) {
	// Added userManager
	const room = activeRooms.get(roomId);
	const user = userManager.getUser(socket.id); // Now userManager is defined

	if (!room || !user) {
		return { error: true, message: "Room or user not found." };
	}
	if (room.host.socketId !== socket.id) {
		return { error: true, message: "Only the host can start the game." };
	}
	if (room.status === "in-progress") {
		return { error: true, message: "Game is already in progress." };
	}
	if (room.players.length < room.minPlayers) {
		return { error: true, message: `Not enough players. Need at least ${room.minPlayers}.` };
	}

	room.status = "in-progress";
	gameManager.initializeGame(room, data); // Pass the whole room object

	console.log(`Game started in room ${roomId} by ${user.username}`);
	io.to(roomId).emit("game_started", {
		roomId,
		gameState: room.gameState, // Send initial game state
		message: `Game "${room.gameType}" started by ${user.username}!`,
	});
	io.to(roomId).emit("room_update", getRoomInfoForClient(room));

	return { success: true, room };
}

function endGame(io, roomId, gameManager, results) {
	const room = activeRooms.get(roomId);
	if (!room) {
		return { error: true, message: "Room not found to end game." };
	}

	room.status = "finished"; // Or 'waiting' if it can be replayed immediately
	// gameManager.resetGameState(room); // Optionally reset game state

	console.log(`Game ended in room ${roomId}`);
	io.to(roomId).emit("game_ended", { roomId, results }); // results could be scores, winner, etc.
	io.to(roomId).emit("room_update", getRoomInfoForClient(room));

	// Optionally, after a timeout, reset to 'waiting' or close if inactive
	// setTimeout(() => {
	//     const currentRoom = activeRooms.get(roomId);
	//     if (currentRoom && currentRoom.status === 'finished') {
	//         currentRoom.status = 'waiting';
	//         gameManager.resetGameState(currentRoom); // Reset for new game
	//         io.to(roomId).emit('room_update', getRoomInfoForClient(currentRoom));
	//         io.to(roomId).emit('room_reset_for_new_game', { roomId });
	//     }
	// }, 30000); // 30 seconds

	return { success: true, room };
}

function isHost(socketId, roomId) {
	const room = activeRooms.get(roomId);
	return room && room.host.socketId === socketId;
}

function isUsernameTakenInRoom(roomId, username) {
	const room = activeRooms.get(roomId);
	if (!room) return false; // Or throw error if room must exist
	return room.players.some((player) => player.username.toLowerCase() === username.toLowerCase().trim());
}

function updatePlayerUsernameInRoom(io, roomId, socketId, oldUsername, newUsername) {
	const room = activeRooms.get(roomId);
	if (!room) return;

	const playerIndex = room.players.findIndex((p) => p.socketId === socketId);
	if (playerIndex !== -1) {
		room.players[playerIndex].username = newUsername;
		if (room.host.socketId === socketId) {
			room.host.username = newUsername;
		}
		console.log(`Username updated in room ${roomId} for ${socketId}: ${oldUsername} -> ${newUsername}`);
		io.to(roomId).emit("player_username_changed", {
			roomId,
			socketId,
			oldUsername,
			newUsername,
		});
		io.to(roomId).emit("room_update", getRoomInfoForClient(room)); // Send full update
	}
}

module.exports = {
	createRoom,
	joinRoom,
	leaveRoom,
	handlePlayerDisconnect,
	getRoomInfo,
	getRoomInfoForClient,
	getAllActiveRoomsForClient,
	startGame,
	endGame,
	isHost,
	isUsernameTakenInRoom,
	updatePlayerUsernameInRoom,
	// For API routes to check existence
	doesRoomExist: (roomId) => activeRooms.has(roomId),
};
