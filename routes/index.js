const express = require("express");
const path = require("path");
const router = express.Router();

// Pass roomManager to check for room existence
module.exports = function (roomManagerInstance) {
	// Home Page
	router.get("/", (req, res) => {
		res.sendFile(path.join(__dirname, "..", "public", "index.html"));
	});

	// Game Room Routes (deprecated in favor of /game/:gameType/:roomId for clarity)
	// If you still want /room/:roomId:
	router.get("/room/:roomId", (req, res) => {
		const { roomId } = req.params;
		if (roomManagerInstance.doesRoomExist(roomId)) {
			// This page might need to know the gameType if it's generic
			// For this setup, we'll assume game.html (or room.html) handles it
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
			// Check if room's gameType matches URL gameType (optional, but good for consistency)
			const room = roomManagerInstance.getRoomInfo(roomId);
			if (room && room.gameType !== gameType) {
				console.warn(`Mismatch: URL gameType ${gameType}, room gameType ${room.gameType} for room ${roomId}`);
				// Redirect or error
				return res.status(400).send("Game type in URL does not match room's game type.");
			}
			// Serve a generic game page that can adapt, or specific game pages
			res.sendFile(path.join(__dirname, "..", "public", "room.html")); // Using room.html as the game client page
		} else {
			console.warn(`Attempt to access non-existent room via game URL: /game/${gameType}/${roomId}`);
			res.redirect("/");
		}
	});

	return router;
};
