var async     = require("async"),
	Animation = require("./animation"),
	express   = require("express"),
	http      = require("http"),
	socketio  = require("socket.io");

function Playback () {
	this.app = express();
	this.server = http.createServer(this.app);
	this.io = socketio.listen(this.server, { "log level": 0 });
	this.aliases = {};
	this.clients = {};
	this.activeAnimations = {};
	this.init();
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
			return self.apiPlayback(req, res);
		});
		io.sockets.on("connection", function (socket) {
			return self.ioConnection(socket);
		});
	},
	close: function (cb) {
		//this.io.sockets.emit("disconnect");
		this.server.close(cb);
	},
	resolveTargetToSocketId: function (target) {
		if (target === undefined) target = "default";

		if (this.clients[target] !== undefined)
			return target;
		else if (this.aliases[target] !== undefined)
			return this.aliases[target];
	},
	apiPlayback: function (req, res) {
		var self = this;
		var spec = req.body;
		if (spec === undefined) return res.send(400, "No payload");
		if (spec.config === undefined) return res.send(400, "No config specified");

		var targetSocketId = this.resolveTargetToSocketId(spec.target);
		if (targetSocketId === undefined)
			return res.send(400, "Invalid target " + spec.target);

		var animation = new Animation(spec.config);
		async.waterfall([
			function (cb) {
				animation.compile(cb);
			},
			function (cb) {
				//console.info("Async animation playback started");
				self.activeAnimations[targetSocketId] = {
					animation: animation,
					response: res,
					spec: spec,
				};
				console.info(cb);

				// Render the animation and send the first frame.
				animation.render(cb);
			},
			function (result, cb) {
				self.io.sockets.socket(targetSocketId).emit("display", result);
				async.nextTick(cb);
			},
		], function (err) {
			if (err) return res.send(404, "Invalid config: " + err);
			if (! spec.waitUntilComplete)
				return res.send(200, "Okay!  Animation playback started");
		});
	},
	socketAlias: function (socket, name) {
		this.aliases[name] = socket.id;
	},
	socketReady: function (socket) {
		var self = this;
		var active = this.activeAnimations[socket.id];
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
	},
	ioConnection: function (socket) {
		var self = this;
		//console.info("playback client " + socket.id + " connected");
		this.clients[socket.id] = new Date().valueOf();

		socket.on("alias", function (name) {
			return self.socketAlias(socket, name);
		});
		socket.on("disconnect", function () {
			delete self.clients[socket.id];
			// TODO: remove them from all registered aliases.
		});
		socket.on("ready", function () {
			return self.socketReady(socket);
		});
	},
};

module.exports = Playback;
