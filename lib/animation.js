var _ = require("lodash");

function Animation (config) {
	var err = this.validateConfig(config);
	if (err !== undefined) return err;

	this.config = config;
}

Animation.prototype = {
	setFPS: function (fps) {
		this.fps = fps;
	},

	validateConfig: function (config) {
		return;
	},

	renderFrame: function (idx) {
		var frame = [];
		return frame;
	},

	renderSimple: function () {
		var result = [];
		return result;
	},
};

module.exports = Animation;
