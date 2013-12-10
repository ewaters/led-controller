var async = require("async"),
	_        = require("lodash"),
	Playback = require("../lib/playback"),
	request = require("supertest");

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

exports.store_retrieve = function (test) {
	var playback = new Playback();
	playback.server.listen(0);
	var appBaseUrl = "http://127.0.0.1:" + playback.server.address().port;

	var headers = {
		name: "Test storage",
		created: Math.floor(new Date().valueOf() / 1000),
		by: "Jane Doe",
	};
	var store = _.cloneDeep(headers);
	store.config = baseConfig;

	async.series([
		function (cb) {
			playback.redisConnectAnd(function (client, close) {
				async.forEach([ "headers" ], function (key, cb) {
					client.del(playback.redisPrefix + key, cb);
				}, close);
			}, cb);
		},
		function (cb) {
			async.forEach([ "", "_v2", "_v3" ], function (suffix, cb) {
				request(appBaseUrl)
					.post("/api/store")
					.send(_.extend({}, store, { name: store.name + suffix }))
					.expect(200, cb);
			}, cb);
		},
		function (cb) {
			test.ok(true, "Data stored");
			request(appBaseUrl)
				.get("/api/search")
				.send({
					name: "Test storage",
				})
				.expect([ headers ])
				.expect(200, cb);
		},
		function (cb) {
			test.ok(true, "Search found data");
			request(appBaseUrl)
				.get("/api/retrieve")
				.send({
					name: "Test storage",
				})
				.expect(store)
				.expect(200, cb);
		},
		function (cb) {
			test.ok(true, "Retrieve fetched the data");
			request(appBaseUrl)
				.post("/api/mark_played")
				.send({
					name: "Test storage",
				})
				.expect(200, cb);
		},
		function (cb) {
			test.ok(true, "Mark played didn't error");
			request(appBaseUrl)
				.get("/api/retrieve")
				.send({
					name: "Test storage",
				})
				.expect(200)
				.end(function (err, res) {
					if (err) return cb(err);
					var retrieve = _.cloneDeep(res.body);
					test.ok(_.isNumber(retrieve.played_last), "played_last is a number");
					test.equal(retrieve.played_count, 1, "played_count is 1");
					delete retrieve.played_last;
					delete retrieve.played_count;
					//test.equal(JSON.stringify(store), JSON.stringify(retrieve));
					cb();
				});
		},
		function (cb) {
			test.ok(true, "Retrieve fetched updated data");
			return cb();
		},
	], function (err) {
		if (err !== undefined && err !== null) {
			test.ok(! err, "No error occurred during the waterfall");
			console.info("waterfall error:", err);
		}
		playback.close(function () {
			test.done();
		});
	});
};
