const express = require("express");
const router = express.Router();

module.exports = function (roomManagerInstance, gameConfigs) {
	// Get list of available rooms
	router.get("/rooms", (req, res) => {
		try {
			const rooms = roomManagerInstance.getAllActiveRoomsForClient();
			res.json(rooms);
		} catch (error) {
			console.error("API Error GET /rooms:", error);
			res.status(500).json({ error: "Failed to retrieve rooms." });
		}
	});

	// Get specific room information
	router.get("/rooms/:roomId", (req, res) => {
		try {
			const { roomId } = req.params;
			const room = roomManagerInstance.getRoomInfoForClient(roomManagerInstance.getRoomInfo(roomId));
			if (room) {
				res.json(room);
			} else {
				res.status(404).json({ error: "Room not found" });
			}
		} catch (error) {
			console.error(`API Error GET /rooms/${req.params.roomId}:`, error);
			res.status(500).json({ error: "Failed to retrieve room information." });
		}
	});

	// Get list of available game types
	router.get("/games", (req, res) => {
		try {
			const availableGames = Object.entries(gameConfigs).map(([id, config]) => ({
				id: id,
				name: config.name,
				capacity: config.capacity,
				minPlayers: config.minPlayers,
				settings: config.settings || {},
			}));
			res.json(availableGames);
		} catch (error) {
			console.error("API Error GET /games:", error);
			res.status(500).json({ error: "Failed to retrieve game types." });
		}
	});

	return router;
};
