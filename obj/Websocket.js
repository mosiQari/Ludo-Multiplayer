const Validate = require("./Validate").Validate

const Websocket = function (ws) {

    this.ws = ws

    this.open = function () {
        ws.send("Websocket connected on port :8090...")
        console.log("Websocket connected on port :8090...")
    }

    this.message = function (req) {
        //The request should be validated via Validate.validateRequest()
        let valid = new Validate()
        let result = valid.validateRequest(JSON.parse(req))
        
        if (result.status) {
            console.log("The request is valid")
        } else {
            ws.send(JSON.stringify({
                Status: "Your request has been rejected due to following errors:",
                Errors: result.errors
            }))
        }

        // switch (message.__Type){
        //     case "JoinToRoomReq":
        //         break
        //     case "PlayerBackReq":
        //         break
        //     case "DiceRolledReq":
        //         break
        //     case "PlayerMovedReq":
        //         break
        //     case "ResignReq":
        //         break
        //     case "RoomDataReq":
        //         break
        //     case "EndGameReq":
        //         break
        // }
    }

    this.close = function () {
        console.log("Websocket closed!")
    }

}

exports.Websocket = Websocket