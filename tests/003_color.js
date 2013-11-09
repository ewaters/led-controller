var _ = require("lodash"),
	Color = require("../lib/color");

exports.invalid = function (test) {
	test.ok(new Color('RGB', "notacolor") instanceof Error);
	test.ok(new Color('RGB', -10) instanceof Error);
	test.ok(new Color('RGB', 0xffffffff) instanceof Error);
	test.done();
};

exports.red = function (test) {
	var color = new Color('RGB', 0xff0000);
	test.equal(color.red(), 1, "RGB red()");
	test.equal(color.green(), 0, "RGB green()");
	test.equal(color.blue(), 0, "RGB blue()");
	test.done();
};

exports.purple = function (test) {
	var color = new Color('RGB', 0x800080);
	test.equal(color.red().toFixed(2) * 1, 0.5, "RGB red()");
	test.equal(color.green(), 0, "RGB green()");
	test.equal(color.blue().toFixed(2) * 1, 0.5, "RGB blue()");
	test.equal(color.integer(), 0x800080, "RGB integer()");
	test.done();
};

exports.tween = function (test) {
	var colorA = new Color('RGB', 0xff0000),
		colorB = new Color('RGB', 0x0000ff);

	var fade = colorA.tween(0.5, colorB);
	test.equal(fade.red().toFixed(2) * 1, 0.5, "RGB red()");
	test.equal(fade.green(), 0, "RGB green()");
	test.equal(fade.blue().toFixed(2) * 1, 0.5, "RGB blue()");
	test.equal(fade.integer(), 0x800080, "RGB integer()");
	test.done();
};
