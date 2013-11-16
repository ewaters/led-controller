var _         = require("lodash"),
	Animation = require("./animation"),
	express   = require("express"),
	http      = require("http"),
	socketio  = require("socket.io");

function Playback () {
	this.app = express();
	this.server = http.createServer(this.app);
	this.io = socketio.listen(this.server);
	this.aliases = {};
	this.clients = {};
	this.activeAnimations = {};
	this.init();
	return this.server;
}

Playback.prototype = {
	init: function () {
		var app  = this.app,
			io   = this.io,
			self = this;

		app.use(express.json());
		app.use(express.urlencoded());

		app.get("/", function (req, res) {
			res.send(__dirname);
		});

		app.post("/api/playback", function (req, res) {
			var spec = req.body;
			if (spec === undefined) return res.send(400, "No payload");
			if (spec.config === undefined) return res.send(400, "No config specified");

			var target = spec.target;
			if (target !== undefined) target = "default";

			var targetSocketId;
			if (self.clients[target] !== undefined)
				targetSocketId = target;
			else if (self.aliases[target] !== undefined)
				targetSocketId = self.aliases[target];
			if (targetSocketId === undefined)
				return res.send(400, "Invalid target " + target);

			var animation = new Animation(spec.config);
			animation.compile(function (err) {
				if (err) return res.send(404, "Invalid config: " + err);

				console.info("Async animation playback started");
				self.activeAnimations[targetSocketId] = {
					animation: animation,
					response: res,
					spec: spec,
				};

				animation.render(function (err, result) {
					if (err) console.info("animation.render() error:", err);
					console.info("sending first frame to " + targetSocketId);
					io.sockets.socket(targetSocketId).emit("display", result);
				});

				if (! spec.waitUntilComplete)
					return res.send(200, "Okay!  Animation playback started");
			});
		});

		io.sockets.on("connection", function (socket) {
			console.info("playback client " + socket.id + " connected");
			self.clients[socket.id] = new Date().valueOf();

			socket.on("alias", function (name) {
				if (self.aliases[name] === undefined) self.aliases[name] = [];
				self.aliases[name].push(socket.id);

				if (socket._aliases === undefined) socket._aliases = [];
				socket._aliases.push(name);
			});
			socket.on("disconnect", function () {
				delete self.clients[socket.id];
				// TODO: remove them from all registered aliases.
			});
			socket.on("ready", function () {
				var active = self.activeAnimations[socket.id];
				if (! active) return console.info("Socket " + socket.id + " emitted ready though no active animation");
				active.animation.render(function (err, result) {
					if (err) console.info("animation.render() error:", err);
					if (result === null) {
						if (active.spec.waitUntilComplete) {
							active.response.send(200, "Animation completed");
							delete self.activeAnimations[socket.id];
						}
						return;
					}
					socket.emit("display", result);
				});
			});
		});
	},
};

module.exports = Playback;
