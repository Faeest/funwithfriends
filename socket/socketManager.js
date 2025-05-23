// socket/socketManager.js
const userManager = require("./userManager");
const roomManager = require("./roomManager");
const gameManager = require("./gameManager"); // Assuming gameManager might also need io
const config = require("../config");
const mixpanel = require("../config/mixpanel");

module.exports = function (io) {
	io.on("connection", (socket) => {
		console.log(`New client connected: ${socket.id}`);
		let distinctId = userManager.getUser(socket.id)?.username || socket.id;

		socket.on("disconnect", () => {
			console.log(`Client disconnected: ${socket.id}`);
			roomManager.handlePlayerDisconnect(io, socket, userManager, gameManager);
		});

		socket.on("track_view", ({ page }, callback) => {
			try {
				if (!page || !distinctId) {
					socket.emit("custom_error", { message: "Invalid tracking data." });
					if (callback) callback({ error: true, message: "Invalid tracking data." });
					return;
				}
				console.log(`Tracking view for ${distinctId} on page: ${page}`);
				mixpanel.track("Page View", {
					distinct_id: distinctId,
					"Page Name": page,
					"User Agent": socket.handshake.headers["user-agent"],
					Referrer: socket.handshake.headers.referer || "Direct",
					Timestamp: new Date().toISOString(),
				});
				if (callback) callback({ success: true });
			} catch (error) {
				console.error(`Error tracking view for ${socket.id}:`, error);
				socket.emit("custom_error", { message: "Error tracking view." });
				if (callback) callback({ error: true, message: "Error tracking view." });
			}
		});

		socket.on("set_username", ({ username }, callback) => {
			try {
				// Basic validation for username presence is done in userManager
				// Add user if not exists, otherwise update.
				if (username == "") return;
				let user = userManager.getUser(socket.id);
				const oldUsername = user ? user.username : null;

				if (!user) {
					user = userManager.addUser(socket.id, username);
					if (!user) {
						// If addUser failed (e.g. bad username)
						if (callback) callback({ success: false, message: "Invalid username provided." });
						return socket.emit("custom_error", { message: "Invalid username." });
					}
				} else {
					// Check for username duplication if user is in a room
					if (user.currentRoomId && roomManager.isUsernameTakenInRoom(user.currentRoomId, username) && username.trim() !== user.username) {
						if (callback) callback({ success: false, message: `Username "${username}" is taken in this room.` });
						return socket.emit("custom_error", { message: `Username "${username}" is taken in this room.` });
					}
					userManager.updateUsername(socket.id, username);
				}

				// If user is in a room, notify room of username change
				if (user.currentRoomId && oldUsername && oldUsername !== user.username) {
					roomManager.updatePlayerUsernameInRoom(io, user.currentRoomId, socket.id, oldUsername, user.username);
				}

				if (callback) callback({ success: true, username: user.username });
				socket.emit("username_set_success", { username: user.username });
			} catch (error) {
				console.error(`Error setting username for ${socket.id}:`, error);
				if (callback) callback({ success: false, message: error.message || "Error setting username." });
				socket.emit("custom_error", { message: "Error setting username." });
			}
		});

		socket.on("create_room", ({ gameType, username }, callback) => {
			try {
				if (!username || username.trim() === "") {
					socket.emit("custom_error", { message: "Username is required to create a room." });
					if (callback) callback({ error: true, message: "Username is required." });
					return;
				}
				// Ensure user is registered with this username
				let user = userManager.getUser(socket.id);
				if (!user || user.username !== username) {
					const updateResult = userManager.updateUsername(socket.id, username);
					if (!updateResult.success && !userManager.getUser(socket.id)) {
						// if update failed and user still not there
						userManager.addUser(socket.id, username); // try adding
					}
				}

				const result = roomManager.createRoom(io, socket, userManager, gameType, username);
				if (result.error) {
					socket.emit("custom_error", { message: result.message });
					if (callback) callback(result);
				} else {
					mixpanel.track("Room Created", {
						distinct_id: distinctId, // CRITICAL: Identify the user
						"Room ID": result.room.id,
						"Game Type": gameType,
						"Host Username": username,
						Source: "Server",
					});

					socket.emit("room_created", {
						roomId: result.room.id,
						gameType: result.room.gameType,
						roomDetails: roomManager.getRoomInfoForClient(result.room),
					});
					io.emit("room_list_update_needed"); // Signal clients to re-fetch room list
					if (callback) callback(result);
				}
			} catch (error) {
				console.error(`Error creating room for ${socket.id}:`, error);
				socket.emit("custom_error", { message: "Error creating room." });
				if (callback) callback({ error: true, message: "Server error creating room." });
			}
		});

		socket.on("join_room", ({ roomId, username }, callback) => {
			try {
				if (!username || username.trim() === "") {
					socket.emit("custom_error", { message: "Username is required to join a room." });
					if (callback) callback({ error: true, message: "Username is required." });
					return;
				}
				// Ensure user is registered with this username
				let user = userManager.getUser(socket.id);
				if (!user || user.username !== username) {
					const updateResult = userManager.updateUsername(socket.id, username);
					if (!updateResult.success && !userManager.getUser(socket.id)) {
						userManager.addUser(socket.id, username);
					}
				}

				const result = roomManager.joinRoom(io, socket, userManager, gameManager, roomId, username);
				if (result.error) {
					socket.emit("custom_error", { message: result.message });
					if (callback) callback(result);
				} else {
					mixpanel.track("Joined", {
						distinct_id: distinctId, // CRITICAL: Identify the user
						"Room ID": result.room.id,
						"Game Type": result.room.gameType,
						"Host Username": username,
						Source: "Server",
					});

					socket.emit("joined_room_success", {
						roomId: result.room.id,
						gameType: result.room.gameType,
						roomDetails: roomManager.getRoomInfoForClient(result.room),
					});
					io.emit("room_list_update_needed");
					if (callback) callback(result);
				}
			} catch (error) {
				console.error(`Error joining room ${roomId} for ${socket.id}:`, error);
				socket.emit("custom_error", { message: `Error joining room ${roomId}.` });
				if (callback) callback({ error: true, message: `Server error joining room.` });
			}
		});

		socket.on("leave_room_request", ({ roomId }, callback) => {
			// Renamed from 'leave_room' to avoid conflict
			try {
				const user = userManager.getUser(socket.id);
				if (!user || user.currentRoomId !== roomId) {
					socket.emit("custom_error", { message: "You are not in this room or room ID is incorrect." });
					if (callback) callback({ error: true, message: "Not in room or incorrect ID." });
					return;
				}
				const result = roomManager.leaveRoom(io, socket, userManager, roomId);
				if (result.error) {
					socket.emit("custom_error", { message: result.message });
					if (callback) callback(result);
				} else {
					socket.emit("left_room_success", { roomId, roomClosed: result.roomClosed });
					io.emit("room_list_update_needed");
					if (callback) callback(result);
				}
			} catch (error) {
				console.error(`Error leaving room ${roomId} for ${socket.id}:`, error);
				socket.emit("custom_error", { message: `Error leaving room ${roomId}.` });
				if (callback) callback({ error: true, message: `Server error leaving room.` });
			}
		});

		socket.on("start_game_request", ({ roomId }, callback) => {
			try {
				// Pass userManager to startGame
				const result = roomManager.startGame(io, socket, userManager, gameManager, roomId);
				if (result.error) {
					socket.emit("custom_error", { message: result.message });
					if (callback) callback(result);
				} else {
					mixpanel.track("Playing Game", {
						distinct_id: distinctId, // CRITICAL: Identify the user
						"Room ID": result.room.id,
						"Game Type": gameType,
						Source: "Server",
					});

					if (callback) callback(result);
				}
			} catch (error) {
				console.error(`Error starting game in room ${roomId} by ${socket.id}:`, error);
				socket.emit("custom_error", { message: `Error starting game.` });
				if (callback) callback({ error: true, message: `Server error starting game.` });
			}
		});

		socket.on("game_action", ({ roomId, action, data }, callback) => {
			try {
				const room = roomManager.getRoomInfo(roomId);
				const user = userManager.getUser(socket.id);

				if (!room || !user || user.currentRoomId !== roomId) {
					socket.emit("custom_error", { message: "Invalid room or not part of the room." });
					if (callback) callback({ error: true, message: "Invalid room or not part of the room." });
					return;
				}

				const result = gameManager.processGameAction(io, roomManager, room, socket.id, action, data);
				if (result.error) {
					socket.emit("custom_error", { message: result.message });
					if (callback) callback(result);
				} else {
					// game_state_update is emitted by gameManager.processGameAction or updateGameState
					socket.emit("action_processed", { success: true, action, ...result }); // Confirm action processing
					if (callback) callback(result);
				}
			} catch (error) {
				console.error(`Error processing game action for ${socket.id} in room ${roomId}:`, error);
				socket.emit("custom_error", { message: `Error processing game action.` });
				if (callback) callback({ error: true, message: `Server error processing action.` });
			}
		});

		socket.on("chat_message_request", ({ roomId, message }, callback) => {
			// Renamed
			try {
				const user = userManager.getUser(socket.id);
				const room = roomManager.getRoomInfo(roomId);

				if (!user || !room || user.currentRoomId !== roomId) {
					socket.emit("custom_error", { message: "Cannot send message: not in room or room invalid." });
					if (callback) callback({ error: true, message: "Not in room or room invalid." });
					return;
				}
				if (!message || message.trim() === "") {
					socket.emit("custom_error", { message: "Message cannot be empty." });
					if (callback) callback({ error: true, message: "Message empty." });
					return;
				}

				const chatData = {
					roomId,
					username: user.username,
					message: message.trim(),
					timestamp: Date.now(),
					socketId: socket.id,
				};
				io.to(roomId).emit("new_chat_message", chatData);
				mixpanel.track("Chat Sent", {
					distinct_id: distinctId, // CRITICAL: Identify the user
					"Room ID": roomId,
					"Host Username": user.username,
					Source: "Server",
				});
				console.log(`Chat in ${roomId} from ${user.username}: ${message}`);
				if (callback) callback({ success: true, messageData: chatData });
			} catch (error) {
				console.error(`Error handling chat message for ${socket.id} in room ${roomId}:`, error);
				socket.emit("custom_error", { message: `Error sending chat message.` });
				if (callback) callback({ error: true, message: `Server error sending chat.` });
			}
		});

		socket.on("room_list_request", (callback) => {
			// Renamed
			try {
				const rooms = roomManager.getAllActiveRoomsForClient();
				socket.emit("available_rooms", rooms);
				if (callback) callback({ success: true, rooms });
			} catch (error) {
				console.error(`Error fetching room list for ${socket.id}:`, error);
				socket.emit("custom_error", { message: `Error fetching room list.` });
				if (callback) callback({ error: true, message: `Server error fetching rooms.` });
			}
		});

		socket.on("get_room_info_request", ({ roomId }, callback) => {
			// Renamed
			try {
				const room = roomManager.getRoomInfoForClient(roomManager.getRoomInfo(roomId));
				if (room) {
					socket.emit("room_details", room);
					if (callback) callback({ success: true, room });
				} else {
					socket.emit("custom_error", { message: `Room ${roomId} not found.`, redirectToHome: true });
					if (callback) callback({ error: true, message: "Room not found." });
				}
			} catch (error) {
				console.error(`Error fetching room info for ${roomId} by ${socket.id}:`, error);
				socket.emit("custom_error", { message: `Error fetching room info.` });
				if (callback) callback({ error: true, message: `Server error fetching room info.` });
			}
		});

		socket.on("reestablish_in_room", ({ roomId, username, gameType, isHostCreator }, callback) => {
			try {
				console.log(`Attempting to re-establish ${username} (socket ${socket.id}) in room ${roomId}`);
				let room = roomManager.getRoomInfo(roomId);

				// Add/Update user in userManager first
				let user = userManager.getUser(socket.id);
				if (!user) {
					user = userManager.addUser(socket.id, username);
				} else {
					user.username = username; // Ensure username is current
				}
				if (!user) {
					// Should not happen if addUser/update logic is sound
					socket.emit("custom_error", { message: "Failed to establish user session.", redirectToHome: true });
					if (callback) callback({ error: true, message: "User session error." });
					return;
				}
				userManager.setUserRoom(socket.id, roomId);

				if (!room) {
					// Scenario: Room was actually deleted (grace period expired or another issue)
					// As a fallback, if this user was the host creator, try to re-create the room.
					// This is a safety net; ideally, the grace period prevents this.
					if (isHostCreator) {
						console.warn(`Room ${roomId} not found for re-establishment by host. Attempting re-creation.`);
						const creationResult = roomManager.createRoom(io, socket, userManager, gameType, username);
						if (creationResult.error) {
							socket.emit("custom_error", { message: creationResult.message, redirectToHome: true });
							if (callback) callback(creationResult);
							return;
						}
						room = creationResult.room;
						socket.emit("room_details", roomManager.getRoomInfoForClient(room));
						io.emit("room_list_update_needed");
						if (callback) callback({ success: true, room: roomManager.getRoomInfoForClient(room), reestablished: true, recreated: true });
						return;
					} else {
						socket.emit("custom_error", { message: `Room ${roomId} not found or has expired.`, redirectToHome: true });
						if (callback) callback({ error: true, message: "Room not found." });
						return;
					}
				}

				// Room exists, re-link this socket
				socket.join(roomId);

				// Update player list: remove old socketId if present for this username, add/update with new socketId
				room.players = room.players.filter((p) => p.username !== username); // Remove any old entry for this username
				room.players.push({ socketId: socket.id, username: username });

				// If this user was the host, ensure host info is updated with new socketId
				if (room.host.username === username) {
					room.host.socketId = socket.id;
					if (room.host.pendingReconnect) {
						// Clear pending flag if set by grace period logic
						delete room.host.pendingReconnect;
					}
					console.log(`Host ${username} re-established in room ${roomId} with new socket ${socket.id}`);
				}

				console.log(`${username} (socket ${socket.id}) re-established in room ${roomId}. Players: ${room.players.length}`);

				socket.emit("room_details", roomManager.getRoomInfoForClient(room));
				io.to(roomId).emit("room_update", roomManager.getRoomInfoForClient(room)); // Notify everyone
				if (callback) callback({ success: true, room: roomManager.getRoomInfoForClient(room), reestablished: true });
			} catch (error) {
				console.error(`Error re-establishing in room ${roomId} for ${socket.id}:`, error);
				socket.emit("custom_error", { message: `Error re-establishing connection.`, redirectToHome: true });
				if (callback) callback({ error: true, message: "Server error during re-establishment." });
			}
		});
	});
};
