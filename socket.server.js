// socket-server.js
require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const express = require("express"); // <--- Make sure Express is required
const config = require("./config");

// Managers
const userManager = require("./socket/userManager");
const roomManager = require("./socket/roomManager");
const gameManager = require("./socket/gameManager");

const app = express(); // <--- Create an Express app
const httpServer = http.createServer(app); // <--- Pass the app to createServer

const io = new Server(httpServer, {
	cors: {
		origin: config.CORS_ORIGIN_SOCKET,
		methods: ["GET", "POST"],
	},
});

// Initialize Socket.IO connection handling
require("./socket/socketManager")(io, userManager, roomManager, gameManager);

// --- Internal API Endpoints for interfaces-server ---
app.get("/internal/room/:roomId/exists", (req, res) => {
	const { roomId } = req.params;
	// Ensure your roomManager has a 'doesRoomExist' method or similar
	if (roomManager.doesRoomExist(roomId)) {
		res.json({ exists: true });
	} else {
		res.json({ exists: false }); // It's better to return false than 404 for a boolean check
	}
});

app.get("/internal/room/:roomId/info", (req, res) => {
	const { roomId } = req.params;
	// Ensure your roomManager has a 'getRoomInfo' or 'getRoom' method
	const room = roomManager.getRoomInfo(roomId); // Or getRoom(roomId)
	if (room) {
		res.json(
			JSON.parse(
				JSON.stringify({ success: true, room }, (key, value) => {
					if (key.startsWith("_") || typeof value === "function") {
						return undefined;
					}
					return value;
				})
			)
		);
	} else {
		res.status(404).json({ success: false, message: "Room not found" });
	}
});
// --- End Internal API Endpoints ---

httpServer.listen(config.SOCKET_PORT, () => {
	console.log(`Socket server (with internal API) running on http://localhost:${config.SOCKET_PORT}`);
	console.log(`Socket CORS Origin set to: ${config.CORS_ORIGIN_SOCKET}`);
});
