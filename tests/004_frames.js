var _ = require("lodash"),
	Animation = require("../lib/animation");

var RED = 0xff0000,
	GREEN = 0x00ff00,
	BLUE = 0x0000ff,
	SKIP = "__skip__";

var baseConfig = {
	strands: [
		{
			id: 1,
			start: 0,
			end: 5,
		},
	],
	layouts: [
		{
			id: 1,
			dimensions: [ 2, 3 ],
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

var tests = {
	gradient: function () {
		return {
			frame: {
				gradient: [
					{ yPercent: 0, color: RED   },
					{ yPercent: 1, color: GREEN },
				],
			},
			expected: [
				[ RED, SKIP, GREEN ],
				[ RED, SKIP, GREEN ],
			],
		};
	},
};

_.forEach(tests, function (criteriaFunc, label) {
	exports[label] = function (test) {
		var criteria = criteriaFunc();
		var config = _.cloneDeep(baseConfig);
		if (criteria.frame)
			config.animations[0].frames.push(criteria.frame);
		console.info(config);

		var animation = new Animation(config);
		animation.compile(function (err) {
			test.equal(err, null);
			if (err !== null) return;

			var result = animation.render();

			if (criteria.expected !== undefined) {
				var expected = _.flatten(criteria.expected),
					got      = result[ config.strands[0].id ];
				for (var i = 0; i <= expected.length; i++) {
					if (expected[i] === SKIP) {
						got[i] = expected[i] = null;
					}
				}
				var expectedStr = JSON.stringify(expected),
					gotStr      = JSON.stringify(got);
				//if (expectedStr !== gotStr)
					//console.info("Got: " + gotStr + ", expected: " + expectedStr);
				test.equal(gotStr, expectedStr);
			}

			test.done();
		});
	};
});
