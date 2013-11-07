var _ = require("lodash"),
	difflet = require("difflet"),
	console = require("console"),
	Animation = require("../lib/animation");

var RED = 0xff0000,
	GREEN = 0x00ff00;

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

function dataEqual(test, got, expected, message) {
	var differs = JSON.stringify(got) != JSON.stringify(expected);
	if (differs)
		console.info(test + " difflet: " + difflet.compare(got, expected));
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
		{ 1: [ RED, RED, RED, RED ] },
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
		{ 1: [ RED, RED, RED, RED ] },
		"First call to two frame render returns all red"
	);
	dataEqual(test,
		animation.render(),
		{ 1: [ GREEN, GREEN, GREEN, GREEN ] },
		"Second call to two frame render returns all green"
	);
	dataEqual(test,
		animation.render(),
		null,
		"Third call to two frame render returns null"
	);

	test.done();
};
