var _     = require("lodash"),
	Color = require("./color"),
	spawn = require("child_process").spawn;

function Gradient (config) {
	this.config = config;
}

Gradient.prototype = {
	render: function (cb) {
		var result = {};
		for (var x = 0; x < this.config.size[0]; x++) {
			for (var y = 0; y < this.config.size[1]; y++) {
				result[x + "," + y] = new Color("RGB", 0xffffff);
			}
		}
		return cb(null, result);
	},
	argv: function () {
		var points = [];
		_.forEach(this.config.colors, function (item) {
			points.push([ item.x, item.y ].join(','));
			points.push(item.color.magick(1));
		});
		return [
			"-size", "1x5",
			"-depth", "8",
			"-colorspace", "RGB",
			"xc:", "-sparse-color", "Barycentric",
			points.join(" "),
			"txt:-",
		];
	},
};

module.exports = Gradient;
