var _        = require("lodash"),
	http     = require("http"),
	urllib   = require("url"),
	socketio = require("socket.io");

process.on('uncaughtException', function (err) {
	console.log("Caught exception: " + err);
	console.log(err.stack);
});

var playbackPort = 8080,
	controlPort  = 8082;

// Set up control and playback server.

var playbackClientIds = {},
	runningAnimations = {};

var playbackServer = socketio.listen(playbackPort, {
	"log level": 1,
});
playbackServer.sockets.on("connection", function (socket) {
	console.info("playbackServer: client " + socket.id + " connected");
	playbackClientIds[socket.id] = true;
	socket.on("ready", function () {
		console.info("playbackServer: client " + socket.id + " is ready");
		var anim = runningAnimations[socket.id];
		if (anim === undefined) return;
		// TODO
	});
	socket.on("identify", function () {
		socket.emit("identify", socket.id);
	});
	socket.on("disconnect", function () {
		console.info("playbackServer: client " + socket.id + " disconnected");
		delete playbackClientIds[socket.id];
	});
});

var controlServer = http.createServer(function (req, res) {
	console.info("controlServer: client request ", req.url);

	var url = urllib.parse(req.url, true);
	var pathParts = url.pathname.split("/");
	pathParts.shift();
	if (pathParts[0] === "playback") {
		var socketId = pathParts[1];
		if (! playbackClientIds[socketId]) {
			res.statusCode = 404;
			res.end("Invalid socket id '" + socketId + "'\n");
			return;
		}

		var socket = playbackServer.sockets.socket(socketId);
		socket.emit("display", { dont: "known" });
		res.end("controlServer: Display called on " + socket.id + "\n");
		return;
	}

	res.writeHead(200);
	res.end("Hello world");
});
controlServer.listen(controlPort);
