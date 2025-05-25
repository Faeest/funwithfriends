const express = require("express");
const path = require("path");
const router = express.Router();

module.exports = function (roomManagerInstance) {
	router.get("/", (req, res) => {
		res.sendFile(path.join(__dirname, "..", "public", "index.html"));
	});
	router.get("/socket.io/socket.io.js", (req, res) => {
		res.sendFile(path.join(__dirname, "..", "public", "socket.io", "socket.io.js"));
	});
	router.get("/room/:roomId", (req, res) => {
		const { roomId } = req.params;
		if (roomManagerInstance.doesRoomExist(roomId)) {
			res.sendFile(path.join(__dirname, "..", "public", "room.html"));
		} else {
			res.redirect("/");
		}
	});

	// Game Type Pages
	router.get("/game/:gameType/:roomId", (req, res) => {
		const { gameType, roomId } = req.params;
		// Validate gameType from config if necessary
		const config = require("../config");
		if (!config.GAME_CONFIG[gameType]) {
			console.warn(`Invalid game type in URL: ${gameType}`);
			return res.status(404).send("Invalid game type specified.");
		}

		if (roomManagerInstance.doesRoomExist(roomId)) {
			const room = roomManagerInstance.getRoomInfo(roomId);
			if (room && room.gameType !== gameType) {
				console.warn(`Mismatch: URL gameType ${gameType}, room gameType ${room.gameType} for room ${roomId}`);
				return res.status(400).send("Game type in URL does not match room's game type.");
			}
			res.sendFile(path.join(__dirname, "..", "public", "room.html")); // Using room.html as the game client page
		} else {
			console.warn(`Attempt to access non-existent room via game URL: /game/${gameType}/${roomId}`);
			res.redirect("/");
		}
	});

	return router;
};
