var async     = require("async"),
	Animation = require("./animation"),
	Color     = require("./color"),
	express   = require("express"),
	http      = require("http"),
	fs        = require("fs"),
	spawn     = require("child_process").spawn,
	path      = require("path"),
	_         = require("lodash"),
	ppm       = require("ppm"),
	tmp       = require("temporary"),
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
		app.post("/api/preview", function (req, res) {
			return self.apiPreview(req, res);
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
	apiPreview: function (req, res) {
		var self = this;
		var spec = req.body;
		if (spec === undefined) return res.send(400, "No payload");
		if (spec.config === undefined) return res.send(400, "No config specified");
		if (!_.isNumber(spec.fps)) return res.send(400, "Must specify fps as a number");
		if (!_.isNumber(spec.layout)) return res.send(400, "Must specify layout as a number");

		var timeStep = 1 / spec.fps;
		var frameNumber = 1;
		var backgroundColor = [0, 0, 0];

		var tmpDir = new tmp.Dir();
		console.info("Created temporary directory " + tmpDir);
		var frameFiles = [];

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

				// Set up controllable timer.
				var timerElapsed = 0;
				animation.newTimer = function () {
					return { elapsed: function () { return timerElapsed; } };
				};

				var keepRendering = true;
				async.whilst(
					function () { return keepRendering; },
					function (cb) {
						animation.render(function (err, result) {
							if (err !== null) return cb(err);
							if (result === null) {
								keepRendering = false;
								return cb();
							};
							//console.info("Render frame " + frameNumber + " at " + timerElapsed);

							var zeroPadded = frameNumber + "";
							while (zeroPadded.length != 4) {
								zeroPadded = "0" + zeroPadded;
							}
							var frameFn = path.join(tmpDir.path, "frame_" + zeroPadded + ".ppm");
							frameFiles.push(frameFn);

							// Write pixels to file.
							var colorsByPixelId = {};
							_.forEach(result, function (strandValues, strandId) {
								var pixelId = animation.config.strandsById[strandId].start;
								_.forEach(strandValues, function (color) {
									colorsByPixelId[pixelId] = color;
									pixelId++;
								});
							});

							var locationToColor = {};
							_.forEach(targetLayout.locationToPixelIds, function (pixelId, location) {
								var color = colorsByPixelId[pixelId];
								if (color === undefined || color === null) return;
								locationToColor[location] = color;
							});

							var colorAtLocation = function (x, y) {
								var val = locationToColor[x + "," + y];
								if (val === undefined) return backgroundColor;
								var color = new Color("RGB", val);
								var result = [];
								["red", "green", "blue"].forEach(function (channel) {
									result.push( Math.floor(color[channel]() * 255) );
								});
								return result;
							};

							var image = [];
							for (var x = 0; x < targetLayout.dimensions[0]; x++) {
								image[x] = [];
								for (var y = 0; y < targetLayout.dimensions[1]; y++) {
									image[x][y] = colorAtLocation(x, y);
								}
							}

							ppm.serialize(image)
								.pipe(fs.createWriteStream(frameFn))
								.on("finish", function () {
									// Continue to next.
									timerElapsed += timeStep;
									frameNumber++;
									return async.nextTick(cb);
								});
						});
					},
					cb
				);
			},
			function (cb) {
				console.info("Calling convert in " + tmpDir.path);
				var convert = spawn(
					"/usr/bin/convert",
					[ "-delay", Math.floor(timeStep * 100), "frame_????.ppm", "gif:-" ],
					{ cwd: tmpDir.path }
				);
				var buffers = [];
				convert.stdout.on("data", function (data) {
					buffers.push(data);
				});
				convert.on("close", function (code) {
					if (code !== 0)
						return cb("Convert returned a non-zero exit code " + code);
					if (buffers.length === 0)
						return cb("Convert returned no content");
					return cb(null, Buffer.concat(buffers));
				});
			},
			function (gif, cb) {
				res.set("Content-Type", "image/gif");
				res.send(gif);
				return cb();
			},
		], function (renderError) {
			async.series([
				function (cb) {
					async.forEach(frameFiles, fs.unlink, cb);
				},
				function (cb) {
					tmpDir.rmdir(cb);
				},
			], function (removeError) {
				if (removeError !== null) {
					console.error("Cleaning up temporary files encountered an error:", removeError);
				}
				if (renderError) {
					res.send(500, "An unexpected error occurred: " + renderError);
				}
			});
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
