var _ = require("lodash");

var RED = 0xff0000,
	FPS = 10;

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
};

var redFill = {
	id: 1,
	colorspace: "RGB",
	frames: [
		{
			fill: RED
		},
	]
};

exports.basic = function (test) {
	var payload = _.cloneDeep(common);
	payload.animations = [ redFill ];
	payload.playback = [{
		animationId: redFill.id,
		layoutId: 1,
	}];

	var frame = [ RED, RED, RED, RED ];

	var animation = new controller.Animation(payload);

	test.deepEqual(
		animation.renderFrame(1, FPS),
		frame,
		"renderFrame(1, _)"
	);

	test.deepEqual(
		animation.renderSimple(FPS),
		[
			{ display: frame }
		],
		"renderSimple(_)"
	);

	test.done();
};
