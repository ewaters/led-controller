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

exports.basic = function (test) {
	var RED = 0xff0000;

	var payload = common;
	payload.animations = [{
		id: 1,
		colorspace: "RGB",
		frames: [
			{
				fill: RED
			},
		]
	}];

	payload.playback = [{
		animationId: 1,
		layoutId: 1,
	}];

	var expected = [
		[ RED, RED, RED, RED ]
	];

	test.done();
};
