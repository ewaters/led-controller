var _ = require("lodash"),
	onecolor = require("onecolor");

function Color (space, value) {
	if (_.isArray(space)) {
		this.space = space[0];
		this.one = onecolor(space);
		return;
	}

	if (space == "RGB") {
		var b = value % 256;
		value -= b;
		value = value >> 8;
		var g = value % 256;
		value -= g;
		value = value >> 8;
		var r = value;
		this.space = space;
		this.one = onecolor(["RGB", r/255, g/255, b/255, 0]);
		return;
	}

	return new Error("Invalid color space '" + space + "'");
}

Color.prototype = {
	red: function () {
		return this.one.red();
	},
	green: function () {
		return this.one.green();
	},
	blue: function () {
		return this.one.blue();
	},
	integer: function () {
		if (this.space === "RGB") {
			var i = Math.ceil(this.red() * 255);
			i = i << 8;
			i += Math.ceil(this.green() * 255);
			i = i << 8;
			i += Math.ceil(this.blue() * 255);
			return i;
		}
	},
	tween: function (percent, dest) {
		if (this.space !== dest.space) return new Error("Can't tween from one space to another");
		var newColor = [this.space];
		if (this.space === "RGB") {
			[ "red", "green", "blue" ].forEach(function (chan) {
				var dist = dest[chan]() - this[chan]();
				newColor.push( this[chan]() + (dist * percent) );
			}, this);
		}
		return new Color(newColor);
	},
};

module.exports = Color;
