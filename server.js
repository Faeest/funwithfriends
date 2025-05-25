require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const config = require("./config");

// Managers (these are stateful modules)
const userManager = require("./socket/userManager");
const roomManager = require("./socket/roomManager");
const gameManager = require("./socket/gameManager");

// Routers - pass manager instances for data access
const mainRoutes = require("./routes/index")(roomManager); // Pass roomManager for route logic
const apiRoutes = require("./routes/api")(roomManager, config.GAME_CONFIG); // Pass roomManager & gameConfig

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
	cors: {
		origin: config.CORS_ORIGIN, // Use configured origin
		methods: ["GET", "POST"],
	},
});

// Middleware
app.use(express.json()); // For parsing application/json
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded
app.use(express.static(path.join(__dirname, "public"))); // Serve static files

// Setup Routes
app.use("/", mainRoutes);
app.use("/api", apiRoutes);

// Initialize Socket.IO connection handling
require("./socket/socketManager")(io); // Pass the io instance

// Catch-all for 404 Not Found (optional)
app.use((req, res, next) => {
	res.status(404).sendFile(path.join(__dirname, "public", "error", "404.html"));
});

// Global error handler (optional)
app.use((err, req, res, next) => {
	console.error("Global error handler:", err.stack);
	res.status(500).send("Something broke!");
});

server.listen(config.PORT, () => {
	console.log(`Server running on http://localhost:${config.PORT}`);
	console.log(`CORS Origin set to: ${config.CORS_ORIGIN}`);
});
