var _ = require("lodash"),
	async = require("async"),
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
		id: 1,
		animationId: 1,
		layoutId: 1,
	}],
};

var invalidConfigs = {
	strandStartEnd: function (bad) {
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
		return "layouts[1].dimensions must be between 1 and 3 length";
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
	layoutPixelIndiciesMismatch: function (bad) {
		bad.layouts.push({
			id: 2,
			dimensions: [ 2 ],
			pixelIndicies: [ 3, 4 ], // no such pixel 4
		});
		return "layouts[1].pixelIndicies[1] references an unknown pixel id (4)";
	},
	layoutPixelIndiciesString: function (bad) {
		bad.layouts.push({
			id: 2,
			dimensions: [ 2 ],
			pixelIndicies: [ "not", "number" ],
		});
		return "layouts[1].pixelIndicies[0] is not a number ('not')";
	},
	layoutPixelIndiciesRepeated: function (bad) {
		bad.layouts.push({
			id: 2,
			dimensions: [ 2 ],
			pixelIndicies: [ 1, 1 ],
		});
		return "layouts[1].pixelIndicies[1] references an already seen pixel id (1)";
	},
	layoutPixelIndiciesNotArray: function (bad) {
		bad.layouts.push({
			id: 2,
			dimensions: [ 2, 2 ],
			pixelIndicies: [ {}, {} ],
		});
		return "layouts[1].pixelIndicies[0] is not an array";
	},

	playbackMissingId: function (bad, good) {
		bad.playback.push({
			animationId: 1,
			layoutId: 1,
		});
		good.playback.push({
			id: 2,
			animationId: 1,
			layoutId: 1,
		});
		return "Missing required property: id (/properties/playback/items/required/0)";
	},
	playbackMismatch: function (bad) {
		bad.playback.push({
			id: 2,
			animationId: 4,
			layoutId: 2,
		});
		return "playback[1].animationId refers to an id 4 that's not found in animations";
	},

	frameFields: function (bad) {
		bad.animations[0].frames.push({
			iAmAnInvalidFrame: true
		});
		return "Data does not match any schemas from \"oneOf\" (/properties/animations/items/properties/frames/items/oneOf)";
	},
	frameTransitionPrevNext: function (bad) {
		bad.animations[0].frames = [{
			dissolve: true,
			time: 5,
		}];
		return "Failed to compile animationsById[1].frames[0]: can't be a transition without a frame before and after";
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
	blackPixels: function (config) {
		config.animations[0].frames[0].fill = 0;
	},
};

var configsWithDefaults = {
	animation: function () {
		return function (test, obj) {
			var animation = obj.config.animationsById[1];
			test.equal(animation.colorspace, "RGB");
		};
	},
	layoutNullPixelIndicies: function (config) {
		config.layouts.push({
			id: 2,
			dimensions: [ 2, 2 ],
		});
		return function (test, animation) {
			var layout = animation.config.layoutsById[2];
			test.deepEqual([[ 0, 1 ], [ 2, 3 ]], layout.pixelIndicies);
		};
	},
};

_.forEach(invalidConfigs, function (f, label) {
	exports["invalid " + label] = function (test) {
		var goodConfig = _.cloneDeep(baseConfig),
			badConfig  = _.cloneDeep(baseConfig);
		var expectedMessage = f(badConfig, goodConfig);

		async.parallel([
			function (cb) {
				var animation = new Animation(badConfig);
				animation.compile(function (err) {
					if (expectedMessage === undefined && err !== null) {
						var matches = err.match(/^Invalid config: (.+)$/);
						if (matches !== null) {
							console.info("Consider adding the following to " + label + " test func:\nreturn \"" + matches[1] + "\";");
						}
						else {
							console.info(err);
						}
					}

					test.ok(err !== null, "Bad config yielded an error");
					if (expectedMessage !== undefined)
						test.equal(err, "Invalid config: " + expectedMessage);
					return cb();
				});
			},
			function (cb) {
				var animation = new Animation(goodConfig);
				animation.compile(function (err) {
					if (err !== null) {
						console.info(err);
					}
					test.ok(err === null, "Good config yielded no error");
					return cb();
				});
			},
		], function () {
			test.done();
		});
	};
});

_.forEach(validConfigs, function (f, label) {
	exports["valid " + label] = function (test) {
		var good = _.cloneDeep(baseConfig);
		f(good);
		var animation = new Animation(good);
		animation.compile(function (err) {
			test.equal(err, null);
			test.done();
		});
	};
});

_.forEach(configsWithDefaults, function (f, label) {
	exports["default test " + label] = function (test) {
		var config = _.cloneDeep(baseConfig);
		var tester = f(config);
		var animation = new Animation(config);
		animation.compile(function (err) {
			test.equal(err, null);
			tester(test, animation);
			test.done();
		});
	};
});
