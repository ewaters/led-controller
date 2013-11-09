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

exports.oneFrame = function (test) {
	test.expect(2);

	var payload = _.cloneDeep(common);
	payload.animations[0].frames = [
		{
			fill: RED
		},
	];

	var animation = new Animation(payload);
	if (animation instanceof Error) {
		console.info(animation.message);
		return;
	}

	dataEqual(test,
		animation.render(),
		all(RED),
		"First call to render returns all red"
	);
	dataEqual(test,
		animation.render(),
		null,
		"Second call to render returns null"
	);

	test.done();
};

exports.twoFrame = function (test) {
	test.expect(3);

	var payload = _.cloneDeep(common);
	payload.animations[0].frames = [
		{ fill: RED, },
		{ fill: GREEN }
	];

	var animation = new Animation(payload);
	if (animation instanceof Error) {
		console.info(animation.message);
		return;
	}

	dataEqual(test,
		animation.render(),
		all(RED),
		"First call to two frame render returns all red"
	);
	dataEqual(test,
		animation.render(),
		all(GREEN),
		"Second call to two frame render returns all green"
	);
	dataEqual(test,
		animation.render(),
		null,
		"Third call to two frame render returns null"
	);

	test.done();
};

exports.timing = function (test) {
	test.expect(5);

	var payload = _.cloneDeep(common);
	payload.animations[0].frames = [
		{ fill: RED, time: 1 },
		{ fill: GREEN, time: 1 },
	];

	var animation = new Animation(payload);
	if (animation instanceof Error) {
		console.info(animation.message);
		return;
	}
	var timer = installTestTimer(animation);

	dataEqual(test, animation.render(), all(RED));

	timer.elapsed = 0.5;
	dataEqual(test, animation.render(), all(RED));

	timer.elapsed = 1;
	dataEqual(test, animation.render(), all(GREEN));

	timer.elapsed = 1.9;
	dataEqual(test, animation.render(), all(GREEN));

	timer.elapsed = 2;
	dataEqual(test, animation.render(), null);

	test.done();
};

exports.timingSkip = function (test) {
	test.expect(3);

	var payload = _.cloneDeep(common);
	payload.animations[0].frames = [
		{ fill: RED, time: 1 },
		{ fill: GREEN, time: 1 },
		{ fill: BLUE, time: 1 },
	];

	var animation = new Animation(payload);
	if (animation instanceof Error) {
		console.info(animation.message);
		return;
	}
	var timer = installTestTimer(animation);

	dataEqual(test, animation.render(), all(RED));

	timer.elapsed = 2.1;
	dataEqual(test, animation.render(), all(BLUE));

	timer.elapsed = 4;
	dataEqual(test, animation.render(), null);

	test.done();
};

exports.speed = function (test) {
	test.done();
};

exports.transition = function (test) {
	test.expect(3);

	var payload = _.cloneDeep(common);
	payload.animations[0].frames = [
		{ fill: RED, time: 1 },
		{ dissolve: true, time: 1 },
		{ fill: BLUE, time: 1 },
	];

	var animation = new Animation(payload);
	if (animation instanceof Error) {
		console.info(animation.message);
		return;
	}
	var timer = installTestTimer(animation);

	dataEqual(test, animation.render(), all(RED));

	timer.elapsed = 1.5;
	// http://meyerweb.com/eric/tools/color-blend/
	dataEqual(test, animation.render(), all(0x800080));

	timer.elapsed = 2.1;
	dataEqual(test, animation.render(), all(BLUE));

	test.done();
};

exports.repeatForever = function (test) {
	test.expect(5);

	var payload = _.cloneDeep(common);
	payload.animations[0].frames = [
		{ fill: RED },
		{ fill: GREEN },
	];
	payload.playback[0].repeat = -1;

	var animation = new Animation(payload);
	if (animation instanceof Error) {
		console.info(animation.message);
		return;
	}

	dataEqual(test, animation.render(), all(RED));
	dataEqual(test, animation.render(), all(GREEN));
	dataEqual(test, animation.render(), all(RED));
	dataEqual(test, animation.render(), all(GREEN));
	dataEqual(test, animation.render(), all(RED));

	test.done();
};

exports.repeatCount = function (test) {
	test.expect(5);

	var payload = _.cloneDeep(common);
	payload.animations[0].frames = [
		{ fill: RED },
		{ fill: GREEN },
	];
	payload.playback[0].repeat = 1;

	var animation = new Animation(payload);
	if (animation instanceof Error) {
		console.info(animation.message);
		return;
	}

	dataEqual(test, animation.render(), all(RED));
	dataEqual(test, animation.render(), all(GREEN));
	dataEqual(test, animation.render(), all(RED));
	dataEqual(test, animation.render(), all(GREEN));
	dataEqual(test, animation.render(), null);

	test.done();
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

	var animation = new Animation(payload);
	if (animation instanceof Error) {
		console.info(animation.message);
		return;
	}

	dataEqual(test, animation.render(), { 1: [ RED, null, RED, null ] });

	test.done();
};
