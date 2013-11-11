var _     = require("lodash"),
	Color = require("./color"),
	spawn = require("child_process").spawn;

function Gradient (config) {
	this.config = config;
}

process.on('uncaughtException', function (err) {
	console.log("Caught exception: " + err);
});

Gradient.prototype = {
	render: function (cb) {
		var result = {};

		var convert = spawn("convert", this.argv());
		convert.stdout.on('data', function (data) {
			data.toString().split("\n").forEach(function (line) {
				if (/^#/.test(line)) return;
				if (/^\s*$/.test(line)) return;
				var matches = line.match(/^(\d+,\d+):\s+\(.+?\)\s+#(\S+)/);
				if (matches === null) {
					console.info("ERROR: Line '" + line + "' didn't match");
					return;
				}
				result[matches[1]] = new Color("RGB", parseInt("0x" + matches[2]));
			});
		});
		convert.stderr.on('data', function (data) {
			console.info("stderr data: " + data);
		});
		convert.on('close', function (code) {
			if (code !== 0)
				return cb("Convert exited with non-zero status " + code);
			return cb(null, result);
		});
	},
	argv: function () {
		var points = [];
		_.forEach(this.config.colors, function (item) {
			points.push([ item.x, item.y ].join(','));
			points.push(item.color.magick(1));
		});
		return [
			"-size", this.config.size.join("x"),
			"-depth", "8",
			"-colorspace", "RGB",
			"xc:", "-sparse-color", "Barycentric",
			points.join(" "),
			"txt:-",
		];
	},
};

module.exports = Gradient;
