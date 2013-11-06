var _ = require("lodash"),
	console = require("console"),
	Animation = require("../lib/animation");

var RED = 0xff0000;

var baseConfig = {
	strands: [
		{
			id: 1,
			start: 0,
			end: 3,
		},
	],
	layouts: [
		{
			id: 1,
			dimensions: [ 2, 2 ],
			pixelIndicies: [
				[ 0, 1 ],
				[ 2, 3 ],
			],
		},
	],
	animations: [
		{
			id: 1,
			frames: [
				{
					fill: RED,
				},
			]
		},
	],
	playback: [{
		animationId: 1,
		layoutId: 1,
	}],
};

var invalidConfigs = {
	strandStartEnd: function (bad, good) {
		bad.strands.push({
			id: 2,
			start: 10,
			end: 9, // < start
		});
		return "strands[1] start must be <= end";
	},
	strandRepeatedIndicies: function (bad, good) {
		bad.strands.push({
			id: 2,
			start: 3, // this overlaps strand id 1.
			end: 5,
		});
		good.strands.push({
			id: 2,
			start: 4,
			end: 6,
		});
		return "strands[1] index 3 overlaps with strand id 1";
	},
	strandRepeatedId: function (bad, good) {
		bad.strands.push({
			id: 1, // repeated.
			start: 4,
			end: 5,
		});
		good.strands.push({
			id: 2,
			start: 4,
			end: 5,
		});
		return "strands[1] id 1 is not unique";
	},

	layoutInvalidDimensions: function (bad, good) {
		bad.layouts.push({
			id: 2,
			dimensions: [ 1, 1, 1, 1 ], // 4D is not supported.
			pixelIndicies: [ [ [ [ 0 ] ] ] ],
		});
		good.layouts.push({
			id: 2,
			dimensions: [ 1, 1, 1 ], // 3D is.
			pixelIndicies: [ [ [ 0 ] ] ],
		});
		return "layouts[1].dimensions must be between 1 and 3 length"
	},
	layoutPixelIndiciesDimensionMismatch: function (bad, good) {
		bad.layouts.push({
			id: 2,
			dimensions: [ 2 ],
			pixelIndicies: [ 1, 2, 3 ], // too many values.
		});
		good.layouts.push({
			id: 2,
			dimensions: [ 2 ],
			pixelIndicies: [ 1, 2 ],
		});
		return "layouts[1].pixelIndicies.length 3 doesn't match expected 2";
	},
	layoutPixelIndiciesMismatch: function (bad, good) {
		bad.layouts.push({
			id: 2,
			dimensions: [ 2 ],
			pixelIndicies: [ 3, 4 ], // no such pixel 4
		});
		return "layouts[1].pixelIndicies[1] references an unknown pixel id (4)";
	},

	playbackMismatch: function (bad, good) {
		bad.playback.push({
			animationId: 4,
			layoutId: 2,
		});
		return "playback[1].animationId refers to an id 4 that's not found in animations";
	},

	frameInvalid: function (bad, good) {
		bad.animations[0].frames.push({
			iAmAnInvalidFrame: true
		});
	},
};

var validConfigs = {
	layoutPixelIndicies: function (config) {
		config.layouts.push({
			id: 2,
			dimensions: [ 2, 2 ],
			pixelIndicies: [
				[ null, 1 ], // nulls are allowed
				[ 2, null ],
			],
		});
	},
};

_.forEach(invalidConfigs, function (f, label) {
	exports["invalid " + label] = function (test) {
		var good = _.cloneDeep(baseConfig),
			bad  = _.cloneDeep(baseConfig);
		var expectedMessage = f(bad, good);

		var badResult = new Animation(bad),
			goodResult = new Animation(good);

		if (goodResult instanceof Error) {
			console.info(goodResult.message);
		}
		if (expectedMessage === undefined && badResult instanceof Error) {
			var matches = badResult.message.match(/^Invalid config: (.+)$/);
			if (matches !== null) {
				console.info("Consider adding the following to " + label + " test func:\nreturn \"" + matches[1] + "\";");
			}
			else {
				console.info(badResult.message);
			}
		}

		test.ok(badResult instanceof Error, "bad result is an error");
		test.ok(goodResult instanceof Animation, "good result is not an error");
		if (expectedMessage !== undefined) {
			test.equal(badResult.message, "Invalid config: " + expectedMessage);
		}
		test.done();
	};
});

_.forEach(validConfigs, function (f, label) {
	exports["valid " + label] = function (test) {
		var good = _.cloneDeep(baseConfig);
		f(good);
		var goodResult = new Animation(good);
		if (goodResult instanceof Error) {
			console.info(goodResult.message);
		}
		test.ok(goodResult instanceof Animation, "good result is not an error");
		test.done();
	};
});
