const Validate = require("./Validate").Validate
const Player = require("./Player").Player
const Room = require("./Room").Room
const OnlinePlayers = require("./OnlinePlayers").OnlinePlayers
let onlinePlayers = new OnlinePlayers()
const OpenRooms = require("./OpenRooms").OpenRooms
let openRooms = new OpenRooms()

const Websocket = function (ws) {

	this.ws = ws

	/**
	 *
	 */
	this.open = function () {
		this.ws.send("Websocket connected on port :8090...")
		console.log("Websocket connected on port :8090...")
	}

	/**
	 *
	 * @param req
	 */
	this.handleMessage = function (req) {
		req = JSON.parse(req)

		let valid = new Validate()
		let result = valid.validateRequest(req)// The request should be validated via Validate.validateRequest()

		if (result.status) {// Valid request
			this.message = req

			switch (this.message.__Type) {
				case "InitialReq": // Registering player in the Websocket server
					this.handleInitialReq()
					break
				case "CreateRoomReq": // When player creates a room
					this.handleCreateRoomReq()
					break
				case "JoinToRoomReq": // Player wants to join a room
					this.handleJoinToRoomReq()
					break
				case "PlayerBackReq": // When player was suspended and resumes
					this.handlePlayerBackReq()
					break
				case "DiceRolledReq": // When player rolled dice
					this.handleDiceRolledReq()
					break
				case "PlayerMovedReq": // When player moved
					this.handlePlayerMovedReq()
					break
				case "RoomDataReq":
					this.handleRoomDataReq()
					break
			}

		} else {// Unauthorized request
			this.terminateConnection(result)
		}
	}

	//  HANDLE FUNCTIONS

	/**
	 *
	 */
	this.handleInitialReq = function () {
		let player = new Player(undefined, this.message.PlayerID)

		if (!player.id) {// Unauthorized request
			this.terminateConnection(player)
		} else {
			player.setBasicProperty("ws", this.ws)// Relate user information sent via HTTPS and other information sent via Websocket
			player.setProperty("state", "wait")// Set player's state in <OnlinePlayers>

			// Call some functions to notify the player
			this.sendInitialRes(player)// To the player
			this.sendRoomsListUpdate(player)// Send OPEN_ROOMS data to the player
		}

	}

	/**
	 *
	 */
	this.handleCreateRoomReq = function () {
		let player = new Player(this.ws)

		if (player.ws) {// Player is found!
			let room = new Room(player, undefined, {
				Capacity: this.message.Settings.Capacity,
				SafeSquares: this.message.Settings.SafeSquares,
				FirstTurnExit: this.message.Settings.FirstTurnExit
			}) //Create room

			if (room.id) {// The room is ready for players to join
				console.log("A room has been added to the rooms list by " + player.name)

				this.sendCreateRoomRes(room)// To the room's creator
				this.sendRoomsListUpdate(player, true, false)// To all waiting players except the player
			} else {// The room is not found!
				this.terminateConnection(player)
			}
		} else {// The player is not found!
			this.terminateConnection(player)
		}

	}

	/**
	 *
	 */
	this.handleJoinToRoomReq = function () {
		let player = new Player(this.ws)

		if (player.ws) {// Player is found!
			let room = new Room(undefined, this.message.RoomID)// Find room by id

			if (room.id) {// Room is found!
				let result = room.joinPlayer(player)

				if (result.status) {// Room confirmed joining player
					player.setProperty("roomId", room.id)// Add room id to the player's properties
					player.setProperty("turn", room.players.findIndex(e => e.id === player.id) + 1)

					this.sendJoinToRoomRes(player, room)// To the joined player
					this.sendRoomsListUpdate(player, true, false)// To all waiting players

					if (result.room.state === "play") {
						this.handleGameStart(result.room)
					}
				} else {
					this.sendError(result)
				}

			} else {// The room is not found!
				this.terminateConnection(room)
			}
		} else {// The player is not found!
			this.terminateConnection(player)
		}
	}

	/**
	 * This method sends <GameStart> response to the all
	 * members of a room.
	 * @param room
	 */
	this.handleGameStart = function (room) {
		let that = this
		room.players.forEach(function (player) {
			let ply = new Player(player.ws)

			ply.setProperty("state", "play")
			that.sendGameStart(player, room)
		})
	}

	/**
	 *
	 */
	this.handlePlayerBackReq = function () {
		let room = new Room(undefined, this.message.RoomID)

		if (room.id) {
			let player = new Player(undefined, this.message.PlayerID)

			if (player.id) {
				let result = room.has(player)

				if (result.status) {
					player.setBasicProperty("ws", player.ws)
					this.sendPlayerBackRes(player, room, true)
				} else {
					this.sendPlayerBackRes(player, room, false)
				}
			} else {
				this.terminateConnection(player)
			}
		} else {
			this.terminateConnection(room)
		}
	}

	/**
	 *
	 */
	this.handleDiceRolledReq = function () {
		let player = new Player(this.ws)

		if (player.id) {
			let room = new Room(undefined, openRooms.getByPlayer(player).room.id)

			if (room.id) {
				room.setData("dice", this.message.Dice)

				this.sendDiceRolledRes(player, room)
			} else {
				this.terminateConnection(room)
			}
		} else {
			this.terminateConnection(player)
		}
	}

	/**
	 *
	 */
	this.handlePlayerMovedReq = function () {
		let player = new Player(this.ws)

		if (player.id) {
			let room = new Room(undefined, openRooms.getByPlayer(player).room.id)

			if (room.id) {
				this.sendPlayerMovedRes(player, room)
			} else {
				this.terminateConnection(room)
			}
		} else {
			this.terminateConnection(player)
		}
	}

	this.handleRoomDataReq = function () {
		let player = new Player(this.ws)

		if (player.id) {
			let room = new Room(undefined, openRooms.getByPlayer(player).room.id)

			if (room.id) {
				//store data in room.data.gameState
				room.setData("gameState", this.message.GameState)
				room.setData("dice", this.message.Dice)
				room.setData("turn", this.message.Turn)
				console.log("Player:" + player.id + " saved data in room: " + room.id)
			} else {
				this.terminateConnection(room)
			}
		} else {
			this.terminateConnection(player)
		}
	}

	//End of HANDLE FUNCTIONS

	// SEND RESPONSE FUNCTIONS

	/**
	 *
	 * @param player
	 */
	this.sendInitialRes = function (player) {
		this.ws.send(JSON.stringify({
			__Type: "InitialRes",
			Player: {
				Name: player.name,
				Avatar: player.avatar
			}
		}))
	}


	/**
	 *
	 * @param player
	 * @param broadcast
	 * @param sendToMe
	 */
	this.sendRoomsListUpdate = function (player, broadcast = false, sendToMe = true) {// Sends a list of rooms with details to the players with state of "wait"
		let sendList = []

		if (!broadcast) {
			sendList.push(player)
		} else {
			onlinePlayers.list().forEach(function (ply) {
				if (ply.state === "wait" && ply.id !== player.id) {
					sendList.push(ply)
				}
			})
		}

		if (!sendToMe && sendList.length) {
			if (sendList.find(e => e.id === player.id)) {
				sendList.splice(sendList.indexOf(player), 1)
			}
		}

		sendList.forEach(function (ply) {
			ply.ws.send(JSON.stringify({
				__Type: "RoomsListUpdate",
				Rooms: openRooms.list()
			}))
		})

	}

	/**
	 *
	 * @param room
	 */
	this.sendCreateRoomRes = function (room) {
		room.creator.ws.send(JSON.stringify({
			__Type: "CreateRoomRes",
			RoomID: room.id
		}))
	}

	/**
	 *
	 * @param player
	 * @param room
	 */
	this.sendJoinToRoomRes = function (player, room) {
		player.ws.send(JSON.stringify({
			__Type: "JoinToRoomRes",
			Settings: room.settings,
			PlayerNumber: player.turn
		}))
	}

	/**
	 *
	 * @param player
	 * @param room
	 */
	this.sendGameStart = function (player, room) {

		player.ws.send(JSON.stringify({
			__Type: "GameStart",
			Players: this.formatPlayers(room.players)
		}))
	}

	/**
	 *
	 * @param player
	 * @param room
	 * @param result
	 */
	this.sendPlayerBackRes = function (player, room, result) {
		if (result) {
			this.ws.send(JSON.stringify({
				__Type: "PlayerBackRes",
				Result: true,
				Turn: room.data.turn,
				Dice: room.data.dice,
				GameState: room.data.gameState,
				ElapsedTime: player.elapsedTime,
				Players: this.formatPlayers(room.players)
			}))
		} else {
			this.ws.send(JSON.stringify({
				__Type: "PlayerBackRes",
				Result: false
			}))
		}
	}

	/**
	 * @param player
	 * @param room
	 */
	this.sendDiceRolledRes = function (player, room) {
		let that = this
		room.players.forEach(function (ply) {
			if (ply.id !== player.id) {
				ply.ws.send(JSON.stringify({
					__Type: "DiceRolledRes",
					Dice: that.message.Dice,
					PlayerNumber: player.turn
				}))
			}
		})
	}

	/**
	 *
	 * @param player
	 * @param room
	 */
	this.sendPlayerMovedRes = function (player, room) {
		let that = this
		room.players.forEach(function (ply) {
			if (ply.id !== player.id) {
				ply.ws.send(JSON.stringify({
					__Type: "PlayerMovedRes",
					Pawn: that.message.Pawn,
					StepCount: that.message.StepCount,
					PlayerNumber: player.turn
				}))
			}
		})
	}

	/**
	 * This method sends the normal (no high-risk)
	 * errors.
	 * @param result
	 */
	this.sendError = function (result) {
		this.ws.send(JSON.stringify({
			__Type: "Error",
			Errors: result.errors
		}))
	}

	/**
	 * This method shows the error and terminates
	 * the websocket connection. Usually this method
	 * is called when a high-risk issue happens in
	 * the system.
	 * @param result
	 */
	this.terminateConnection = function (result) {
		this.ws.send(JSON.stringify({
			__Type: "FatalError",
			Errors: result.errors
		}))
		// this.ws.terminate()
	}

	// End of SEND RESPONSE FUNCTIONS

	/**
	 *
	 */
	this.close = function () {
		console.log("Websocket closed!")
	}

	/**
	 *This method formats players array to sending in responses.
	 * @param players
	 * @return {[]}
	 */
	this.formatPlayers = function (players) {
		let result = []

		players.forEach(function (player) {
			result.push({
				PlayerID: player.id,
				NickName: player.name,
				Avatar: player.avatar
			})
		})

		return result
	}

}

exports.Websocket = Websocket