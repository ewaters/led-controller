var async     = require("async"),
	Animation = require("./animation"),
	express   = require("express"),
	http      = require("http"),
	uuid      = require("uuid"),
	redis     = require("redis"),
	_         = require("lodash"),
	stringify = require("json-stable-stringify"),
	socketio  = require("socket.io");

function Playback () {
	this.app = express();
	this.server = http.createServer(this.app);
	this.io = socketio.listen(this.server, { "log level": 0 });
	this.aliases = {};
	this.clients = {};
	this.activeAnimations = {};
	this.compiledAnimations = {};
	this.socketsReady = {};
	this.redisPrefix = "";
	this.init();
}

Playback.prototype = {
	init: function () {
		var app  = this.app,
			io   = this.io,
			self = this;

		app.use(express.json());
		app.use(express.urlencoded());
		app.use(express.static(__dirname + "/../public"));

		app.get("/", function (req, res) {
			res.send(__dirname);
		});
		app.post("/api/playback", function (req, res) {
			return self.apiPlayback(req, res);
		});
		app.post("/api/preview", function (req, res) {
			return self.apiPreview(req, res);
		});
		app.get("/api/preview/:id/animation.gif", function (req, res) {
			return self.apiPreviewFetch(req, res);
		});
		app.post("/api/store", function (req, res) {
			return self.apiStore(req, res);
		});
		app.get("/api/search", function (req, res) {
			return self.apiSearch(req, res);
		});
		app.get("/api/retrieve", function (req, res) {
			return self.apiRetrieve(req, res);
		});
		app.post("/api/mark_played", function (req, res) {
			return self.apiMarkPlayed(req, res);
		});
		io.sockets.on("connection", function (socket) {
			return self.ioConnection(socket);
		});

		// TODO: Routinely clear old, unused compiled animations
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
		if (this.socketsReady[targetSocketId] === undefined)
			return res.send(400, "Target " + spec.target + " is not ready");

		console.info("Playback called for " + targetSocketId);

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

				// Render the animation and send the first frame.
				animation.render(cb);
			},
			function (result, cb) {
				console.info("Playback started; first frame sent");
				self.io.sockets.socket(targetSocketId).emit("display", result);
				async.nextTick(cb);
			},
		], function (err) {
			if (err) return res.send(404, "Invalid config: " + err);
			if (! spec.waitUntilComplete)
				return res.send(200, "Okay!  Animation playback started");
		});
	},
	apiPreview: function (req, res) {
		var self = this;
		var spec = req.body;
		if (spec === undefined) return res.send(400, "No payload");
		if (spec.config === undefined) return res.send(400, "No config specified");
		if (!_.isNumber(spec.fps)) return res.send(400, "Must specify fps as a number");
		if (!_.isNumber(spec.layout)) return res.send(400, "Must specify layout as a number");

		var animation = new Animation(spec.config);
		async.waterfall([
			function (cb) {
				animation.compile(cb);
			},
			function (cb) {
				// Select the target layout to prepare for converting to images.
				var targetLayout = animation.config.layoutsById[spec.layout];
				if (targetLayout === undefined) return cb("Layout " + spec.layout + " doesn't exist");
				if (targetLayout.dimensions.length !== 2) return cb("Target layout is not 2D");
				return cb();
			},
		], function (err) {
			if (err !== undefined) {
				res.send(400, "Invalid config passed: " + err);
				return;
			}
			// TODO: Hash the config to allow for caching of the animation and a determinstic url.
			var id = uuid.v4();

			// TODO: Store config in redis to allow for node.js restarts.
			self.compiledAnimations[id] = {
				created:   new Date().valueOf(),
				animation: animation,
				spec:      spec,
			};
			res.json({
				uri: "/api/preview/" + id + "/animation.gif",
			});
		});
	},
	apiPreviewFetch: function (req, res) {
		// Fetch data from cache.
		var cached = this.compiledAnimations[req.params.id];
		if (cached === undefined)
			return res.send(404, "Invalid id " + req.params.id);
		cached.lastAccess = new Date().valueOf();
		var animation = cached.animation,
			spec      = cached.spec;

		var targetLayout = animation.config.layoutsById[spec.layout];
		async.waterfall([
			function (cb) {
				animation.renderToAnimatedGif(targetLayout, spec.fps, cb);
			},
			function (gif, cb) {
				res.set("Content-Type", "image/gif");
				res.set("Content-Length", gif.length);
				res.end(gif, "binary");
				return cb();
			},
		], function (err) {
			if (err) res.send(500, "Internal error occurred: " + err);
		});
	},

	redisConnectAnd: function (func, cb) {
		//redis.debug_mode = true;
        var client = redis.createClient();
		client.on("error", function (err) {
			console.log("Error " + err);
		});
		func(client, function (err) {
			client.quit([], function () { if (cb) cb(err); });
		});
	},

	redisHeaderSearch: function (headers, cb) {
		var self = this;
		var list;
		this.redisConnectAnd(
			function (client, next) {
				client.lrange([ self.redisPrefix + "headers", 0, -1 ], function (err, value) {
					if (err) {
						return next(err);
					}
					list = JSON.parse(value);
					if (! _.isArray(list)) list = [ list ];
					return next();
				});
			},
			function (err) {
				if (err) return cb(err);
				var result = [];
				_.forEach(list, function (item) {
					var matches = true;
					_.forEach(headers, function (matchValue, matchKey) {
						if (item[matchKey] !== matchValue) matches = false;
					});
					if (! matches) return;
					result.push(item);
				});
				console.info(list, headers);
				return cb(null, result);
			}
		);
	},

	apiStore: function (req, res) {
		var self = this;
		var body = req.body;
		if (body === undefined) return res.send(400, "No payload");
		if (body.config === undefined) return res.send(400, "No config specified");

		var headers = _.clone(body);
		delete headers.config;

		this.redisConnectAnd(function (client, close) {
			async.parallel([
				function (cb) {
					client.lpush(self.redisPrefix + "headers", stringify(headers), cb);
				},
				function (cb) {
					client.set(self.redisPrefix + "config:" + stringify(headers), body, cb);
				}
			], function (err) {
				if (err) {
					res.send(500, "Redis error: " + err);
				}
				else {
					res.send(200);
				}
				return close();
			});
		});
	},
	apiSearch: function (req, res) {
		this.redisHeaderSearch(req.body, function (err, results) {
			if (err) return res.send(500, err);
			return res.send(results);
		});
	},
	apiRetrieve: function (req, res) {
		res.send(500, "Not implemented");
	},
	apiMarkPlayed: function (req, res) {
		res.send(500, "Not implemented");
	},

	socketAlias: function (socket, name) {
		this.aliases[name] = socket.id;
	},
	socketReady: function (socket) {
		var self = this;
		var active = this.activeAnimations[socket.id];
		this.socketsReady[socket.id] = true;
		if (! active) return console.info("Socket " + socket.id + " emitted ready though no active animation");


		active.animation.render(function (err, result) {
			if (err) console.info("animation.render() error:", err);
			if (result === null) {
				console.info("Animation completed");
				if (active.spec.waitUntilComplete) {
					active.response.send(200, "Animation completed");
					delete self.activeAnimations[socket.id];
				}
				return;
			}
			//console.info("Displaying next result");
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
			delete self.socketsReady[socket.id];
			// TODO: remove them from all registered aliases.
		});
		socket.on("ready", function () {
			return self.socketReady(socket);
		});
	},
};

module.exports = Playback;
