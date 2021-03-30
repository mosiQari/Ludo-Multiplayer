const express = require("express")
const app = express()
const Player = require("./obj/Player").Player
const Validate = require("./obj/Validate").Validate
const WebSocketServer = require("ws").Server
const wss = new WebSocketServer({port: 8090})
const WS = require("./obj/Websocket").Websocket
const util = require("./functions")


let valid = new Validate()

app.use(function(req, res, next) {
	res.header("Access-Control-Allow-Origin", "*")
	next()
})

app.get('/', function (req, res) {
	res.send("Ludo Multiplayer! Go to Register to start the game.")
})

app.get('/register/:username', function (req, res) {
	res.setHeader('Content-Type', 'application/json')

	let result = valid.validateString(req.params["username"], 3, 10)

	if (result.status) {
		let player = new Player(undefined)

		res.write(JSON.stringify({
			status: true,
			Player: {
				PlayerID: player.id,
				Avatar: player.avatar
			}
		}))

		player.setBasicProperty("name", req.params["username"])

	} else {
		res.write(JSON.stringify(result))
	}
	res.end()
})

wss.on('connection', function (ws) {
	let socket = new WS(ws)

	ws.onopen = socket.open()
	ws.on('message', function (message) {
		socket.handleMessage(message)
	})
	ws.on('close', function () {
		socket.close()
	})
})

app.listen(8080)
console.log("HTTP connected on port :8080...")