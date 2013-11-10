var _        = require("lodash"),
	Color    = require("../lib/color"),
	Gradient = require("../lib/gradient");

var WHITE = new Color("RGB", 0xffffff),
	BLACK = new Color("RGB", 0x000000);

exports.simple = function (test) {
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

	gradient.render(function (err, result) {
		test.equal(err, null);
		if (err !== null) {
			console.info(err);
			return;
		}

		_.forEach(result, function (val, key) {
			console.info(key + " has color " + val.hex());
		});

		test.done();
	});
};
