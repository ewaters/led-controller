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
			// Determine defined pixel indicies.
			var pixelIdToStrandId = {}; // pixel id to strand id mapping
			_.forEach(config.strands, function (strand, index) {
				if (strand.end < strand.start) {
					err = "strand[" + index + "] start must be <= end";
					return false;
				}
				for (var i = strand.start; i <= strand.end; i++) {
					if (pixelIdToStrandId[i] !== undefined) {
						err = "strand[" + index + "] index " + i + " overlaps with strand id " + pixelIdToStrandId[i];
						return false;
					}
					pixelIdToStrandId[i] = strand.id;
				}
			});
			if (err !== "") break;

			_.forEach(config.layouts, function (layout, index) {
				var dimensionSize = layout.dimensions.length;

				if (dimensionSize == 0 || dimensionSize > 3) {
					err = "layout[" + index + "].dimensions must be between 1 and 3 length";
					return false;
				}

				if (layout.pixelIndicies === undefined) {
					// TODO - fill in
					err = "filling in pixelIndicies is currently not supported";
					return;
				}

				var usedPixelIds = {};
				function recurse (array, dimension, breadcrumb) {
					if (array.length != layout.dimensions[dimension - 1]) {
						return breadcrumb + ".length " + array.length + " doesn't match expected " + layout.dimensions[dimension - 1 ];
					}
					if (dimension === dimensionSize) {
						// Verify array contains only null or pixel ids.
						for (var i = 0; i < array.length; i++) {
							if (_.isNull(array[i])) continue;
							if (! _.isNumber(array[i])) {
								return breadcrumb + "[" + i + "] is not a number ('" + array[i] + "')";
							}
							if (usedPixelIds[array[i]] !== undefined) {
								return breadcrumb + "[" + i + "] references an already seen pixel id (" + array[i] + ")";
							}
							usedPixelIds[array[i]] = true;
							if (pixelIdToStrandId[array[i]] === undefined) {
								return breadcrumb + "[" + i + "] references an unknown pixel id (" + array[i] + ")";
							}
						}
					}
					else {
						// Verify array contains only layout.dimensions[dimension - 1] arrays.
						for (var i = 0; i < array.length; i++) {
							if (! _.isArray(array[i])) {
								return breadcrumb + "[" + i + "] is not an array";
							}
							var result = recurse(array[i], dimension + 1, breadcrumb + "[" + i + "]");
							if (result !== undefined) return result;
						}
					}
				};
				var result = recurse(layout.pixelIndicies, 1, "layouts[" + index + "].pixelIndicies");
				if (result !== undefined) {
					err = result;
					return false;
				}
			});
			if (err !== "") break;

			// Fill in default values
			// TODO

			// Ensure all entities have domain-wide unique IDs, and create lookup maps.
			_.forEach(config, function (section, sectionKey) {
				var lookup = {};
				_.forEach(section, function (item, itemIndex) {
					if (item.id === undefined) return;
					if (lookup[item.id] !== undefined) {
						err = sectionKey + "[" + itemIndex + "] id " + item.id + " is not unique";
						return false;
					}
					lookup[item.id] = item;
				});
				if (err !== "") return false;
				config[sectionKey + "ById"] = lookup;
			});
			if (err != "") break;

			// Check that fields named "*Id" refer to another item
			// in another section.
			_.forEach(config, function (section, sectionKey) {
				_.forEach(section, function (item, itemIndex) {
					_.forEach(item, function (value, key) {
						if (! /Id$/.test(key)) return;

						var matches = key.match(/^(.+)Id$/);
						var refSection = matches[1] + 's';
						if (config[refSection + "ById"][value] === undefined) {
							err = sectionKey + "[" + itemIndex + "]." + key + " refers to an id " + value + " that's not found in " + refSection;
							return false;
						}
					});
					if (err !== "") return false;
				});
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
