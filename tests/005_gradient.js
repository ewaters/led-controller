var _        = require("lodash"),
	Color    = require("../lib/color"),
	Gradient = require("../lib/gradient");

var WHITE = new Color("RGB", 0xffffff),
	BLACK = new Color("RGB", 0x000000);

exports.simple = function (test) {
	test.expect(4);
	var gradient = new Gradient({
		size: [ 1, 5 ],
		colors: [
			{ x: 0, y: 0, color: WHITE },
			{ x: 0, y: 4, color: BLACK },
		],
	});
	if (gradient instanceof Error) {
		console.info(gradient.message);
		return;
	}

	test.deepEqual(gradient.argv(),
		[
			"-size", "1x5",
			"-depth", "8",
			"-colorspace", "RGB",
			"xc:", "-sparse-color", "Barycentric",
			"0,0 rgb(100.0%,100.0%,100.0%) 0,4 rgb(0.0%,0.0%,0.0%)",
			"txt:-",
		]
	);

	var expected = {
		'0,0': WHITE,
		'0,4': BLACK,
	};

	gradient.render(function (err, result) {
		test.equal(err, null);
		if (err !== null) {
			console.info(err);
			return;
		}

		_.forEach(expected, function (val, key) {
			test.equal(val.hex(), result[key].hex());
		});

		test.done();
	});
};
