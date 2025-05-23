require("dotenv").config();

const GAME_CONFIG = {
	"tic-tac-toe": {
		name: "Tic-Tac-Toe",
		capacity: 2,
		minPlayers: 2,
		colorCode: 1,
	},
	checkers: {
		name: "Checkers",
		capacity: 2,
		minPlayers: 2,
		colorCode: 2,
	},
	"chat-room": {
		// Example of a non-game room type
		name: "Chat Room",
		capacity: 10,
		minPlayers: 1,
		colorCode: 3,
	},
	// Add more game configurations here
};

module.exports = {
	PORT: process.env.PORT || 3000,
	CORS_ORIGIN: process.env.CORS_ORIGIN || "*", // Default to all for simplicity if not set
	GAME_CONFIG,
	DEFAULT_ROOM_CAPACITY: 4, // Fallback if game type not in GAME_CONFIG
	DEFAULT_MIN_PLAYERS: 2, // Fallback
};
