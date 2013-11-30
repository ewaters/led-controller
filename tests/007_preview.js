var async = require("async"),
	Playback = require("../lib/playback"),
	spawn = require("child_process").spawn,
	fs = require("fs"),
	tmp = require("temporary"),
	request = require("supertest");

var RED = 0xff0000,
	GREEN = 0x00ff00;

var baseConfig = {
	strands: [{
		id: 1,
		start: 0,
		end: 3,
	}],
	layouts: [{
		id: 1,
		dimensions: [ 2, 2 ],
		pixelIndicies: [
			[ 0, 1 ],
			[ 2, 3 ],
		],
	}],
	animations: [{
		id: 1,
		frames: [
			{ time: 1, fill: RED },
			{ time: 1, dissolve: true },
			{ time: 1, fill: GREEN },
		]
	}],
	playback: [{
		id: 1,
		animationId: 1,
		layoutId: 1,
	}],
};

function binaryParser(res, callback) {
	res.setEncoding('binary');
	res.data = '';
	res.on('data', function (chunk) {
		res.data += chunk;
	});
	res.on('end', function () {
		callback(null, new Buffer(res.data, 'binary'));
	});
}

exports.basic = function (test) {
	var playback = new Playback();
	playback.server.listen(0);
	var appBaseUrl = "http://127.0.0.1:" + playback.server.address().port;

	var payload = {
		config: baseConfig,
		fps: 5,
		layout: 1,
	};

	async.waterfall([
		function (cb) {
			request(appBaseUrl)
				.post("/api/preview")
				.send(payload)
				.expect(200)
				.expect("Content-Type", /json/)
				.end(function (err, res) {
					if (err) return cb(err);
					test.ok(res.body.uri !== undefined, "URI exists in response");
					return cb(null, res.body.uri);
				});
		},
		function (gifUri, cb) {
			request(appBaseUrl)
				.get(gifUri)
				.expect(200)
				.expect("Content-Type", "image/gif")
				.parse(binaryParser)
				.end(function (err, res) {
					if (err) return cb(err);
					return cb(null, res);
				});
		},
		function (res, cb) {
			var identify = spawn("identify", ["-"]);
			var frames = [];

			identify.stdin.end(res.body);
			identify.stdout.on("data", function (data) {
				var lines = data.toString().split("\n").filter(function (l) { return l.length > 0; });
				frames = frames.concat(lines);
			});
			identify.stderr.on("data", function (data) {
				console.error("stderr data", data.toString());
			});
			identify.on("close", function (code) {
				if (code != 0) {
					console.info(frames);
					return cb("Identify exited with non-zero status " + code);
				}
				test.equal(frames.length, payload.fps * payload.config.animations[0].frames.length);
				return cb();
			});
		},
		function (cb) {
			playback.close(cb);
		},
	], function (err) {
		if (err !== undefined && err !== null) {
			test.ok(! err, "No error occurred during the waterfall");
			console.info("waterfall error:", err);
		}
		test.done();
	});
};
