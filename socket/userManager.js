// socket/userManager.js
const users = new Map(); // Stores socket.id -> { username, currentRoomId }

function addUser(socketId, username) {
	if (!username || typeof username !== "string" || username.trim() === "") {
		console.warn(`Attempted to add user with invalid username: ${username}`);
		return null; // Or throw error
	}
	const user = { username: username.trim(), currentRoomId: null };
	users.set(socketId, user);
	console.log(`User added: ${username} (ID: ${socketId})`);
	return user;
}

function removeUser(socketId) {
	const user = users.get(socketId);
	if (user) {
		users.delete(socketId);
		console.log(`User removed: ${user.username} (ID: ${socketId})`);
		return user;
	}
	return null;
}

function getUser(socketId) {
	return users.get(socketId);
}

function updateUsername(socketId, newUsername) {
	if (!newUsername || typeof newUsername !== "string" || newUsername.trim() === "") {
		return { success: false, message: "Username cannot be empty." };
	}
	const user = users.get(socketId);
	if (user) {
		const oldUsername = user.username;
		user.username = newUsername.trim();
		console.log(`User ${oldUsername} (ID: ${socketId}) changed username to ${user.username}`);
		return { success: true, oldUsername, newUsername: user.username, currentRoomId: user.currentRoomId };
	}
	return { success: false, message: "User not found." };
}

function setUserRoom(socketId, roomId) {
	const user = users.get(socketId);
	if (user) {
		user.currentRoomId = roomId;
	}
}

function clearUserRoom(socketId) {
	const user = users.get(socketId);
	if (user) {
		user.currentRoomId = null;
	}
}

module.exports = {
	addUser,
	removeUser,
	getUser,
	updateUsername,
	setUserRoom,
	clearUserRoom,
};
