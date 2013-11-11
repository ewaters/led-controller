var _ = require("lodash"),
	difflet = require("difflet"),
	console = require("console"),
	Animation = require("../lib/animation");

var RED = 0xff0000,
	GREEN = 0x00ff00,
	BLUE = 0x0000ff;

var common = {
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
			frames: [],
		},
	],
	playback: [
		{
			id: 1,
			animationId: 1,
			layoutId: 1,
		},
	],
};

function all (color) {
	var strandColors = {};
	_.forEach(common.strands, function (strand) {
		var colors = [];
		for (var i = strand.start; i <= strand.end; i++) {
			colors.push(color);
		}
		strandColors[ strand.id ] = colors;
	});
	return strandColors;
}

function installTestTimer (animation) {
	var timer = {
		elapsed: 0,
	};
	animation.newTimer = function () {
		return {
			elapsed: function () { return timer.elapsed; },
		};
	};
	return timer;
}

function dataEqual(test, got, expected, message) {
	if (got instanceof Error)
		console.info(got.message);
	var differs = JSON.stringify(got) != JSON.stringify(expected);
	if (differs)
		console.info("got: " + JSON.stringify(got) + ", expected: " + JSON.stringify(expected));
	test.ok(! differs, message);
}

function testValidConfig(config, cb) {
	var animation = new Animation(config);
	animation.compile(function (err) {
		if (err !== null) {
			console.info(err);
			return;
		}
		cb(animation, installTestTimer(animation));
	});
}

function testRenders(test, config, spec, cb) {
	testValidConfig(config, function (animation, timer) {
		_.forEach(spec, function (item) {
			if (item.time !== undefined) timer.elapsed = item.time;
			dataEqual(test,
				animation.render(),
				item.expect,
				item.msg
			);
		});
		if (cb !== undefined) {
			cb();
		}
		else {
			test.done();
		}
	});
}

exports.oneFrame = function (test) {
	test.expect(2);

	var payload = _.cloneDeep(common);
	payload.animations[0].frames = [
		{
			fill: RED
		},
	];

	testRenders(test, payload, [
		{ expect: all(RED), msg: "First call to render returns all red" },
		{ expect: null, msg: "Second call to render returns null" },
	]);
};

exports.twoFrame = function (test) {
	test.expect(3);

	var payload = _.cloneDeep(common);
	payload.animations[0].frames = [
		{ fill: RED, },
		{ fill: GREEN }
	];

	testRenders(test, payload, [
		{ expect: all(RED), msg: "First call to two frame render returns all red" },
		{ expect: all(GREEN), msg: "Second call to two frame render returns all green" },
		{ expect: null, msg: "Third call to two frame render returns null" },
	]);
};

exports.timing = function (test) {
	test.expect(5);

	var payload = _.cloneDeep(common);
	payload.animations[0].frames = [
		{ fill: RED, time: 1 },
		{ fill: GREEN, time: 1 },
	];

	testRenders(test, payload, [
		{ expect: all(RED) },
		{ time: 0.5, expect: all(RED) },
		{ time: 1, expect: all(GREEN) },
		{ time: 1.9, expect: all(GREEN) },
		{ time: 2, expect: null },
	]);
};

exports.timingSkip = function (test) {
	test.expect(3);

	var payload = _.cloneDeep(common);
	payload.animations[0].frames = [
		{ fill: RED, time: 1 },
		{ fill: GREEN, time: 1 },
		{ fill: BLUE, time: 1 },
	];

	testRenders(test, payload, [
		{ expect: all(RED) },
		{ time: 2.1, expect: all(BLUE) },
		{ time: 4, expect: null },
	]);
};

exports.speed = function (test) {
	test.expect(3);

	var payload = _.cloneDeep(common);
	payload.animations[0].frames = [
		{ fill: RED, time: 1 },
		{ fill: GREEN, time: 1 },
		{ fill: BLUE, time: 1 },
	];
	payload.playback[0].speed = 2;

	testRenders(test, payload, [
		{ expect: all(RED) },
		{ time: 0.5, expect: all(GREEN) },
		{ time: 1, expect: all(BLUE) },
	]);
};

exports.transition = function (test) {
	test.expect(3);

	var payload = _.cloneDeep(common);
	payload.animations[0].frames = [
		{ fill: RED, time: 1 },
		{ dissolve: true, time: 1 },
		{ fill: BLUE, time: 1 },
	];

	testRenders(test, payload, [
		{ expect: all(RED) },
		{ time: 1.5, expect: all(0x800080) }, // http://meyerweb.com/eric/tools/color-blend/
		{ time: 2.1, expect: all(BLUE) },
	]);
};

exports.repeatForever = function (test) {
	test.expect(5);

	var payload = _.cloneDeep(common);
	payload.animations[0].frames = [
		{ fill: RED },
		{ fill: GREEN },
	];
	payload.playback[0].repeat = -1;

	testRenders(test, payload, [
		{ expect: all(RED) },
		{ expect: all(GREEN) },
		{ expect: all(RED) },
		{ expect: all(GREEN) },
		{ expect: all(RED) },
	]);
};

exports.repeatCount = function (test) {
	test.expect(5);

	var payload = _.cloneDeep(common);
	payload.animations[0].frames = [
		{ fill: RED },
		{ fill: GREEN },
	];
	payload.playback[0].repeat = 1;

	testRenders(test, payload, [
		{ expect: all(RED) },
		{ expect: all(GREEN) },
		{ expect: all(RED) },
		{ expect: all(GREEN) },
		{ expect: null },
	]);
};

exports.selection = function (test) {
	test.expect(1);

	var payload = _.cloneDeep(common);
	payload.animations[0].frames = [
		{ fill: RED, },
	];
	payload.selections = [{
		id: 1,
		criteria: "pixelIndex % 2 == 0",
	}];
	payload.playback[0].selectionId = 1;

	testRenders(test, payload, [
		{ expect: { 1: [ RED, null, RED, null ] } },
	]);
};

exports.concurrentPlayback = function (test) {
	test.expect(3);

	var payload = _.cloneDeep(common);

	// Fill with red and repeat forever.
	payload.animations[0].frames = [
		{ fill: RED, },
	];
	payload.playback[0].repeat = -1;
	payload.playback[0].concurrentWithNext = true;

	// Make every other alternating green and blue.
	payload.animations.push({
		id: 2,
		frames: [
			{ fill: GREEN },
			{ fill: BLUE },
		],
	});
	payload.selections = [{
		id: 1,
		criteria: "pixelIndex % 2 == 0",
	}];
	payload.playback.push({
		id: 2,
		animationId: 2,
		layoutId: 1,
		selectionId: 1,
		repeat: -1,
	});

	testRenders(test, payload, [
		{ expect: { 1: [ GREEN, RED, GREEN, RED ] } },
		{ expect: { 1: [ BLUE, RED, BLUE, RED ] } },
		{ expect: { 1: [ GREEN, RED, GREEN, RED ] } },
	]);
};
