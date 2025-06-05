// routes/index.js (for interfaces-server.js)
const express = require("express");
const path = require("path");
const fetch = require("node-fetch"); // <--- Import node-fetch
const config = require("../config"); // <--- To get SOCKET_PORT

const router = express.Router();

// This module no longer takes roomManagerInstance directly
module.exports = function (/* roomManagerInstance - removed */) {
	router.get("/", (req, res) => {
		res.sendFile(path.join(__dirname, "..", "public", "index.html"));
	});

	// This route is likely handled by express.static if socket.io.js is in your /public folder.
	// Or, client should fetch it from the socket server directly: <script src="http://localhost:SOCKET_PORT/socket.io/socket.io.js"></script>
	// If you intend to serve it from interfaces-server, ensure the file is in public/socket.io/
	// router.get("/socket.io/socket.io.js", (req, res) => {
	//  res.sendFile(path.join(__dirname, "..", "public", "socket.io", "socket.io.js"));
	// });

	router.get("/room/:roomId", async (req, res) => {
		// <--- Made async
		const { roomId } = req.params;
		try {
			const response = await fetch.default(`http://localhost:${config.SOCKET_PORT}/internal/room/${roomId}/exists`);
			if (!response.ok) {
				// Check if the fetch itself was successful
				console.error(`Internal API error checking room existence: ${response.status} ${await response.text()}`);
				return res.redirect("/"); // Or show an error page
			}
			const data = await response.json();

			if (data.exists) {
				res.sendFile(path.join(__dirname, "..", "public", "room.html"));
			} else {
				res.redirect("/");
			}
		} catch (error) {
			console.error("Failed to connect to socket server for room existence check:", error);
			res.status(500).send("Error checking room status. Please try again later.");
		}
	});

	// This route serves room.html generically. The client-side JS on this page
	// would then need to handle joining or creating a specific room.
	router.get("/room", (req, res) => {
		res.sendFile(path.join(__dirname, "..", "public", "room.html"));
	});

	router.get("/game/:gameType/:roomId", async (req, res) => {
		// <--- Made async
		const { gameType, roomId } = req.params;

		// Validate gameType from config locally (still useful)
		if (!config.GAME_CONFIG || !config.GAME_CONFIG[gameType]) {
			console.warn(`Invalid game type in URL: ${gameType}`);
			return res.status(404).send("Invalid game type specified.");
		}

		try {
			const response = await fetch.default(`http://localhost:${config.SOCKET_PORT}/internal/room/${roomId}/info`);
			if (!response.ok) {
				if (response.status === 404) {
					console.warn(`Attempt to access non-existent room (API 404) for game URL: /game/${gameType}/${roomId}`);
				} else {
					console.error(`Internal API error fetching room info: ${response.status} ${await response.text()}`);
				}
				return res.redirect("/");
			}
			const data = await response.json();

			if (data.success && data.room) {
				const room = data.room;
				// Check if the room retrieved has a gameType property
				if (room.gameType && room.gameType !== gameType) {
					console.warn(`Mismatch: URL gameType ${gameType}, room gameType ${room.gameType} for room ${roomId}`);
					return res.status(400).send("Game type in URL does not match room's game type.");
				}
				// If room.gameType is undefined on the fetched room object, this check might be bypassed.
				// Ensure your room objects on the socket-server always have a gameType.
				res.sendFile(path.join(__dirname, "..", "public", "room.html"));
			} else {
				// This case covers data.success being false or data.room not existing
				console.warn(`Attempt to access non-existent room or invalid data for game URL: /game/${gameType}/${roomId}`);
				res.redirect("/");
			}
		} catch (error) {
			console.error("Failed to connect to socket server for game/room info check:", error);
			res.status(500).send("Error checking game/room status. Please try again later.");
		}
	});

	return router;
};
