require("dotenv").config();
const am_i = require("./data_am_i.json");
const GAME_CONFIG = {
	"chat-room": {
		name: "Chat Room",
		capacity: 10,
		minPlayers: 1,
		colorCode: 3,
		settings: {
			censor: 1,
		},
	},
	"am-i": {
		name: "am I ...",
		capacity: 10,
		minPlayers: 2,
		colorCode: 1,
		settings: {
			category: am_i.settings.category,
		},
	},
	undercover: {
		name: "Undercover",
		capacity: 10,
		minPlayers: 3,
		colorCode: 2,
	},
	"undercover-question": {
		name: "The question was ...",
		capacity: 10,
		minPlayers: 1,
		colorCode: 3,
	},
	// Add more game configurations here
};

module.exports = {
	SOCKET_PORT: process.env.SOCKET_PORT || 3001,
	PORT: process.env.PORT || 3000,
	CORS_ORIGIN_SOCKET: process.env.CORS_ORIGIN_SOCKET || `http://localhost:${process.env.PORT || 3000}`, // Where the client UI is served from
	CORS_ORIGIN_INTERFACES: process.env.CORS_ORIGIN_INTERFACES || "*",
	CORS_ORIGIN: process.env.CORS_ORIGIN || "*", // Default to all for simplicity if not set
	GAME_CONFIG,
	DEFAULT_ROOM_CAPACITY: 4, // Fallback if game type not in GAME_CONFIG
	DEFAULT_MIN_PLAYERS: 2, // Fallback
};
