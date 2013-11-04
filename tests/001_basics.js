var _ = require("lodash"),
	difflet = require("difflet"),
	console = require("console"),
	Animation = require("../lib/animation");

var RED = 0xff0000,
	GREEN = 0x00ff00,
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

function dataEqual(test, got, expected, message) {
	var s = difflet.compare(got, expected);
	var differs = s !== "";
	test.ok(! differs, message + "\n" + s);
}

exports.basics = function (test) {
	var payload = _.cloneDeep(common);
	var redFill = {
		id: 1,
		frames: [
			{
				fill: RED
			},
		]
	};

	payload.animations = [ redFill ];
	payload.playback = [{
		animationId: redFill.id,
		layoutId: 1,
	}];

	(function () {
		var animation = new Animation(payload);
		animation.setFPS(FPS);

		var frame = [ RED, RED, RED, RED ];
		dataEqual(test,
			animation.renderFrame(1),
			frame,
			"solid red renderFrame(1)"
		);

		dataEqual(test,
			animation.renderSimple(),
			[
				{ display: frame }
			],
			"solid red renderSimple()"
		);
	})();

	payload.animations.push({
		id: 2,
		frames: [
			{ fill: RED, time: 1 },
			{ fill: GREEN }
		],
	});
	payload.playback[0] = {
		animationId: 2,
		layoutId: 1,
		speed: 1,
	};

	(function () {
		var animation = new Animation(payload);
		animation.setFPS(FPS);

		var redFrame = [ RED, RED, RED, RED ],
			greenFrame = [ GREEN, GREEN, GREEN, GREEN];

		dataEqual(test,
			animation.renderFrame(1),
			redFrame,
			"two frame renderFrame(1)"
		);
		dataEqual(test,
			animation.renderFrame(FPS),
			greenFrame,
			"two frame renderFrame(" + FPS + ")"
		);

		dataEqual(test,
			animation.renderSimple(),
			[
				{ display: redFrame },
				{ delay: 1.0 },
				{ display: greenFrame },
			],
			"solid red renderSimple()"
		);
	})();
	
	test.done();
};
