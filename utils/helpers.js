const { v4: uuidv4 } = require('uuid');

// Generates a short, somewhat unique alphanumeric ID (e.g., for room codes)
function generateRoomId(length = 6) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

module.exports = {
    generateUUID: uuidv4,
    generateRoomId,
};