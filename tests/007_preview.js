var async = require("async"),
	Playback = require("../lib/playback"),
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

exports.basic = function (test) {
	var playback = new Playback();
	playback.server.listen(0);
	var appBaseUrl = "http://127.0.0.1:" + playback.server.address().port;

	async.waterfall([
		function (cb) {
			request(appBaseUrl)
				.post("/api/preview")
				.send({
					config: baseConfig,
					fps: 5,
					layout: 1,
				})
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
				.end(function (err, res) {
					return cb(err);
				});
		},
	], function (err) {
		if (err !== undefined && err !== null) {
			test.ok(! err, "No error occurred during the waterfall");
			console.info("waterfall error:", err);
		}
		test.done();
	});
};
