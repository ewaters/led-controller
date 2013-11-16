var _ = require("lodash"),
	async = require("async"),
	Playback = require("../lib/playback"),
	clientio = require("socket.io-client"),
	request = require("supertest");

var port = 8080;

var RED = 0xff0000;

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
			{ fill: RED },
		]
	}],
	playback: [{
		id: 1,
		animationId: 1,
		layoutId: 1,
	}],
};

exports.basic = function (test) {
	var app = new Playback();
	app.listen(0);
	var port = app.address().port;
	var appBaseUrl = "http://127.0.0.1:" + port;
	console.info("Using " + appBaseUrl);

	var client, clientDisplayCalls = [];

	async.waterfall([
		function (cb) {
			client = clientio
				.connect(appBaseUrl)
				.on("connect", function () {
					console.info("client connected; setting alias");
					client.emit("alias", "default");
					cb();
				})
				.on("error", function (err) {
					test.ok(false, "Client received error: " + err);
				})
				.on("disconnect", function () {
					test.ok(false, "Client disconnected unexpectedly");
				})
				.on("display", function (data) {
					console.info("client display: ", data);
					clientDisplayCalls.push(data);
					client.emit("ready");
				});
		},
		function (cb) {
			request(appBaseUrl)
				.post("/api/playback")
				.send({
					target: "default",
					config: baseConfig,
					waitUntilComplete: true,
				})
				.expect(200, cb);
		},
		function (res, cb) {
			console.info("Playback completed");
			test.equal(clientDisplayCalls.length, 1);
			test.deepEqual(clientDisplayCalls[0], { 1: [ 0xff0000, 0xff0000, 0xff0000, 0xff0000 ] });
			client.removeAllListeners("disconnect");
			client.disconnect();
			app.close(cb);
		},
		function (cb) {
			console.info("app closed");
			cb();
		},
	], function (err) {
		if (err !== undefined) {
			test.ok(! err, "No error occurred during the waterfall");
			console.info("waterfall error: " + err);
		}
		test.done();
	});
};
