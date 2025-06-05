// socket/gameManager.js

// This is a placeholder. Specific game logic will be implemented here.
// For now, it just sets up a generic game state.

function initializeGame(room) {
	// Example: Tic-Tac-Toe
	if (room.gameType === "chat-room") {
		room.gameState = {
			template: room.amiTemplate || "default",
			currentPlayer: room.players[0].socketId,
			turn: room.players[0].username,
			winner: null,
			isDraw: false,
		};
	} else if (room.gameType === "am-i") {
		room.gameState = {
			template: room.amiTemplate || "default",
		};
	} else if (room.gameType === "undercover") {
		room.gameState = {
			isVote: false,
			readyToVote: 0,
			unvercoderId: null,
			votes: {},
		};
	} else if (room.gameType === "undercover-question") {
		room.gameState = {
			board: [],
			pieces: {},
			currentPlayer: room.players[0].socketId,
			turn: room.players[0].username,
		};
	} else {
		room.gameState = {
			message: `Game type ${room.gameType} initialized. No specific logic yet.`,
			turn: room.players.length > 0 ? room.players[0].username : "N/A",
		};
	}
	console.log(`Game initialized for room ${room.id} (Type: ${room.gameType}):`, room.gameState);
}

function updateGameState(io, room, newState) {
	room.gameState = newState;
	io.to(room.id).emit("game_state_update", room.gameState);
	console.log(`Game state updated for room ${room.id}:`, room.gameState);
}

function processGameAction(io, roomManager, room, socketId, action, data) {
	// Server-side validation of the action
	// Example: For Tic-Tac-Toe, action might be 'make_move', data could be { cellIndex }
	console.log(`Processing game action for room ${room.id} from ${socketId}:`, action, data);

	const player = room.players.find((p) => p.socketId === socketId);
	if (!player) {
		return { error: true, message: "Player not found in room." };
	}

	if (room.status !== "in-progress") {
		return { error: true, message: "Game is not currently in progress." };
	}

	// --- Example for Tic-Tac-Toe ---
	if (room.gameType === "tic-tac-toe" && room.gameState) {
		if (action === "make_move") {
			if (room.gameState.currentPlayer !== socketId) {
				return { error: true, message: "Not your turn." };
			}
			const { cellIndex } = data;
			if (cellIndex === undefined || cellIndex < 0 || cellIndex > 8 || room.gameState.board[cellIndex] !== null) {
				return { error: true, message: "Invalid move." };
			}

			const symbol = room.players[0].socketId === socketId ? "X" : "O";
			room.gameState.board[cellIndex] = symbol;

			// Check for winner or draw (simplified)
			const winner = checkTicTacToeWinner(room.gameState.board);
			if (winner) {
				room.gameState.winner = winner === "X" ? room.players[0].username : room.players[1].username;
				room.gameState.currentPlayer = null; // Game over
				roomManager.endGame(io, room.id, module.exports, { winner: room.gameState.winner }); // Pass self for reset
			} else if (room.gameState.board.every((cell) => cell !== null)) {
				room.gameState.isDraw = true;
				room.gameState.currentPlayer = null; // Game over
				roomManager.endGame(io, room.id, module.exports, { draw: true });
			} else {
				// Switch player
				room.gameState.currentPlayer = room.players.find((p) => p.socketId !== socketId).socketId;
				room.gameState.turn = room.players.find((p) => p.socketId === room.gameState.currentPlayer).username;
			}
			updateGameState(io, room, room.gameState);
			return { success: true, message: "Move processed." };
		}
	}
	// --- End Tic-Tac-Toe Example ---

	// Generic action processing if no specific game logic matched
	// For instance, just echoing the action or storing it.
	room.gameState.lastAction = { player: player.username, action, data, timestamp: Date.now() };
	updateGameState(io, room, room.gameState);

	return { success: true, message: `Action '${action}' received.` };
}

function checkTicTacToeWinner(board) {
	const lines = [
		[0, 1, 2],
		[3, 4, 5],
		[6, 7, 8], // rows
		[0, 3, 6],
		[1, 4, 7],
		[2, 5, 8], // cols
		[0, 4, 8],
		[2, 4, 6], // diagonals
	];
	for (let i = 0; i < lines.length; i++) {
		const [a, b, c] = lines[i];
		if (board[a] && board[a] === board[b] && board[a] === board[c]) {
			return board[a]; // 'X' or 'O'
		}
	}
	return null;
}

function resetGameState(room) {
	// Called by roomManager.endGame if game is to be reset for replay
	console.log(`Resetting game state for room ${room.id} (Type: ${room.gameType})`);
	initializeGame(room); // Re-initialize
}

module.exports = {
	initializeGame,
	updateGameState,
	processGameAction,
	resetGameState,
};
