var _ = require("lodash"),
	schema = require("./schema");

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
		var schemaErr = schema.validate(config);
		if (schemaErr !== undefined) return schemaErr;

		var err = "";
		for (;;) {
			["strands", "layouts", "animations", "playback"].forEach(function (key) {
				/*
				_.forEach(config[key], function (sectionItem, idx) {
					// Inspect each item for adherence to the template.
					_.forEach(template[key], function (tval, tkey) {
						if (sectionItem[tkey] === undefined) {
							if (tval.required) {
								err = "'" + key + "[" + idx + "]." + tkey + "' is required";
								return false;
							}
							else if (tval.defValue !== undefined) {
								sectionItem[tkey] = tval.defValue;
							}
						}

						// Check that fields named "*Id" refer to another item
						// in another section.
						if (/Id$/.test(tkey)) {
							var matches = tkey.match(/^(.+)Id$/);
							var refSection = matches[1] + 's';
							var id = sectionItem[tkey];
							var found = _.find(config[refSection], function (testVal) { return testVal.id === id });
							if (found === undefined) {
								err = "'" + key + ':' + tkey + "' refers to an id " + id + " that's not found in " + refSection;
								return false;
							}
						}
					});
					// Create lookup table by id.
				});
				*/
				if (err != "") return false;
			});
			if (err != "") break;

			config.strands.forEach(function (item) {
			});

			break;
		}
		if (err != "") return new Error("Invalid config: " + err);
		return;
	},

	renderFrame: function (idx) {
		var frame = [];
		return frame;
	},

	renderSimple: function () {
		var result = [];
		_.forEach(this.config.playback, function (item) {
			result.push(this.renderSimplePlayback(item));
		}, this);
		return result;
	},

	renderSimplePlayback: function (playback) {
		var result = [];
		var animation = this.config.animationsById[playback.animationId];
		return result;
	},
};

module.exports = Animation;
