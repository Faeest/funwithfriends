/**
 * A game instance class with event-driven architecture for handling game events.
 * Provides methods for adding, removing, and emitting events with support for method chaining.
 */
class GameInstance {
	/**
	 * Creates a new GameInstance with the specified game type.
	 * @param {string} gameType - The type/name of the game (e.g., 'TicTacToe', 'Chess')
	 */
	constructor(gameType) {
		/**
		 * The type/name of the game
		 * @type {string}
		 */
		this.gameType = gameType;

		/**
		 * Storage for event listeners organized by event type
		 * @type {Object.<string, Function[]>}
		 */
		this.events = {};

		this.initializeEvents();
	}

	/**
	 * Initializes default event types with empty listener arrays.
	 * @private
	 */
	initializeEvents() {
		const defaultEvents = ["gameStarted", "gameStateUpdate", "gameEnded", "playerJoined", "playerLeft", "cleanup"];
		defaultEvents.forEach((eventType) => {
			this.events[eventType] = [];
		});
	}

	/**
	 * Adds an event listener for the specified event type.
	 * @param {string} eventType - The name of the event to listen for
	 * @param {Function} callback - The function to call when the event is emitted
	 * @returns {GameInstance} Returns this instance for method chaining
	 * @throws {Error} Throws an error if callback is not a function
	 * @example
	 * gameInstance.on('gameStarted', (data) => {
	 *   console.log('Game started with:', data);
	 * });
	 */
	on(eventType, callback) {
		if (typeof callback !== "function") {
			throw new Error("Callback must be a function");
		}
		if (!this.events[eventType]) {
			this.events[eventType] = [];
		}
		this.events[eventType].push(callback);
		return this;
	}

	/**
	 * Removes an event listener for the specified event type.
	 * @param {string} eventType - The name of the event
	 * @param {Function} [callback] - The specific callback to remove. If not provided, removes all listeners for the event type
	 * @returns {GameInstance} Returns this instance for method chaining
	 * @example
	 * // Remove specific listener
	 * gameInstance.off('gameStarted', myCallback);
	 *
	 * // Remove all listeners for an event
	 * gameInstance.off('gameStarted');
	 */
	off(eventType, callback) {
		if (!this.events[eventType]) {
			return this;
		}
		if (callback) {
			const index = this.events[eventType].indexOf(callback);
			if (index > -1) {
				this.events[eventType].splice(index, 1);
			}
		} else {
			this.events[eventType] = [];
		}
		return this;
	}

	/**
	 * Adds a one-time event listener that will be automatically removed after being called once.
	 * @param {string} eventType - The name of the event to listen for
	 * @param {Function} callback - The function to call when the event is emitted
	 * @returns {GameInstance} Returns this instance for method chaining
	 * @example
	 * gameInstance.once('gameEnded', (result) => {
	 *   console.log('Game ended:', result);
	 * });
	 */
	once(eventType, callback) {
		const onceWrapper = (...args) => {
			callback(...args);
			this.off(eventType, onceWrapper);
		};
		this.on(eventType, onceWrapper);
		return this;
	}

	/**
	 * Emits an event, calling all registered listeners for that event type.
	 * @param {string} eventType - The name of the event to emit
	 * @param {...*} args - Arguments to pass to the event listeners
	 * @returns {GameInstance} Returns this instance for method chaining
	 * @example
	 * gameInstance.emit('gameStarted', { players: 2, mode: 'online' });
	 * gameInstance.emit('playerJoined', { name: 'Alice', id: 1 });
	 */
	emit(eventType, ...args) {
		if (!this.events[eventType]) {
			return this;
		}
		this.events[eventType].forEach((callback) => {
			try {
				callback(...args);
			} catch (error) {
				console.error(`Error in ${this.gameType} event listener for '${eventType}':`, error);
			}
		});
		return this;
	}

	/**
	 * Gets all listeners for a specific event type.
	 * @param {string} eventType - The name of the event
	 * @returns {Function[]} Array of listener functions (shallow copy)
	 * @example
	 * const gameStartedListeners = gameInstance.listeners('gameStarted');
	 */
	listeners(eventType) {
		return this.events[eventType] ? [...this.events[eventType]] : [];
	}

	/**
	 * Gets all event types that currently have listeners.
	 * @returns {string[]} Array of event type names that have active listeners
	 * @example
	 * const activeEvents = gameInstance.eventNames();
	 * console.log('Events with listeners:', activeEvents);
	 */
	eventNames() {
		return Object.keys(this.events).filter((eventType) => this.events[eventType].length > 0);
	}

	/**
	 * Removes all listeners for a specific event type, or all listeners for all events.
	 * @param {string} [eventType] - The specific event type to clear. If not provided, clears all listeners
	 * @returns {GameInstance} Returns this instance for method chaining
	 * @example
	 * // Remove all listeners for a specific event
	 * gameInstance.removeAllListeners('gameStarted');
	 *
	 * // Remove all listeners for all events
	 * gameInstance.removeAllListeners();
	 */
	removeAllListeners(eventType) {
		if (eventType) {
			this.events[eventType] = [];
		} else {
			Object.keys(this.events).forEach((key) => {
				this.events[key] = [];
			});
		}
		return this;
	}

	/**
	 * Destroys the game instance by emitting a cleanup event and removing all listeners.
	 * This method should be called when the game instance is no longer needed.
	 * @example
	 * gameInstance.destroy(); // Emits 'cleanup' event then removes all listeners
	 */
	destroy() {
		this.emit("cleanup");
		this.removeAllListeners();
	}
}

async function createGameInstance(gameType) {
	try {
		if (typeof gameType !== "string" || !gameType.trim()) {
			throw new Error("Invalid game type provided");
		}
		const gi = new GameInstance(gameType);
		const gameTypes = await fetch("/api/games/id").then((res) => res.json());
		if (!gameTypes.includes(gameType)) {
			throw new Error(`Game type '${gameType}' is not supported`);
		} else {
			if (gi.gameType === "chat-room") {
			} else if (gi.gameType === "am-i") {
				gi.on("gameStarted", (data) => {
					const gameArea = document.getElementById("gameArea");
					if (gameArea) {
						gameArea.firstChild.textContent = "Game Started!";
						delay(1000).then(() => {});
					}
				});
			} else if (gi.gameType === "undercover") {
			} else if (gi.gameType === "undercover-question") {
			} else {
				throw new Error(`Game type '${gameType}' is not implemented yet`);
			}
		}
		return gi;
	} catch (error) {
		return { error: true, message: error.message };
	}
}

function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
