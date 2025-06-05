// interfaces-server.js
require("dotenv").config();
const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors"); // For API CORS
const config = require("./config");
const mainRoutes = require("./routes/index")(); // Pass nothing if it doesn't need live manager state
const apiRoutes = require("./routes/api")(null, config.GAME_CONFIG); // Pass null for roomManager, or adapt apiRoutes

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({ origin: config.CORS_ORIGIN_INTERFACES })); // CORS for API requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Setup Routes
app.use("/", mainRoutes);
app.use("/api", apiRoutes);

// Catch-all for 404 Not Found
app.use((req, res, next) => {
	res.status(404).sendFile(path.join(__dirname, "public", "error", "404.html"));
});

// Global error handler
app.use((err, req, res, next) => {
	console.error("Global error handler (Interfaces):", err.stack);
	res.status(500).send("Something broke on the interfaces server!");
});

server.listen(config.PORT, () => {
	console.log(`Interfaces server running on http://localhost:${config.PORT}`);
	console.log(`Interfaces CORS Origin set to: ${config.CORS_ORIGIN_INTERFACES}`);
	console.log(`Client should connect to Socket server at ws://localhost:${config.SOCKET_PORT}`);
});
