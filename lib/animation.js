var _ = require("lodash"),
	schema = require("./schema");

function Animation (config) {
	var err = this.validateConfig(config);
	if (err !== undefined) return err;

	this.config = config;
	this.playbackContext = [];
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
					err = "strands[" + index + "] start must be <= end";
					return false;
				}
				for (var i = strand.start; i <= strand.end; i++) {
					if (pixelIdToStrandId[i] !== undefined) {
						err = "strands[" + index + "] index " + i + " overlaps with strand id " + pixelIdToStrandId[i];
						return false;
					}
					pixelIdToStrandId[i] = strand.id;
				}
			});
			if (err !== "") break;

			// Validate layouts.
			_.forEach(config.layouts, function (layout, index) {
				var dimensionSize = layout.dimensions.length;

				if (dimensionSize == 0 || dimensionSize > 3) {
					err = "layouts[" + index + "].dimensions must be between 1 and 3 length";
					return false;
				}

				if (layout.pixelIndicies === undefined) {
					// TODO - fill in
					err = "filling in pixelIndicies is currently not supported";
					return;
				}

				layout.usedPixelIds = {};
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
							if (layout.usedPixelIds[array[i]] !== undefined) {
								return breadcrumb + "[" + i + "] references an already seen pixel id (" + array[i] + ")";
							}
							layout.usedPixelIds[array[i]] = true;
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

			// Validate animations.
			_.forEach(config.animations, function (animation, index) {
				_.forEach(animation.frames, function (frame, frameIndex) {
					// TODO
				});
			});

			break;
		}
		if (err != "") return new Error("Invalid config: " + err);
		return;
	},

	render: function () {
		// TODO: One or more playbacks may be current, as they may be playing simultaneously.
		return this.renderPlayback( this.config.playback[0] );
	},

	renderPlayback: function (playback) {
		// Fetch a persistent context for this playback from the Animation.
		// This is what tracks how far we have progressed into the playback.
		if (this.playbackContext[ playback.id ] === undefined)
			this.playbackContext[ playback.id ] = {
				timer: null,
				curFrameIndex: 0,
			};
		var context = this.playbackContext[ playback.id ];

		// If playback is done, return null.
		if (context.done) return null;

		var animation = this.config.animationsById[playback.animationId],
			layout    = this.config.layoutsById[playback.layoutId];

		// Fetch the current frame.
		var curFrame = animation.frames[context.curFrameIndex];

		// Check to see if the current frame is time-based, and is still visible.
		// If it's not, find the next valid frame to display.
		if (curFrame.time !== undefined) {
			// TODO
		}

		// Fetch a function to call for each x(,y)(,z) location in the layout matrix.
		var renderFunc = this.getRenderFramePixelFunc(curFrame, layout);
		if (renderFunc instanceof Error) return renderFunc;

		// Call the renderFramePixel function for each visible layout location.
		var strandsColors = this.forEachLayoutLocation(layout, renderFunc);

		// If the current frame is not time-based, we need to move the playback
		// index forward, and possibly loop it if we need to repeat.
		if (curFrame.time === undefined) {
			// Check if we're at the end of the playback.
			if (animation.frames[ context.curFrameIndex + 1 ] === undefined) {
				if (playback.repeat !== undefined) {
					// TODO
				}
				else {
					context.done = true;
				}
			}
			else {
				// There is a next frame; prepare for next render() call.
				context.curFrameIndex++;
			}
		}

		return strandsColors;
	},

	// Return a function which, when passed an object containing variables such
	// as x, y, z, maxX, maxY, maxZ, returns a color for that pixel, based upon
	// the frame definition and the optionally layout and time.
	getRenderFramePixelFunc: function (frame, layout) {
		if (frame.fill) {
			// frame.fill is the color to return in all cases.
			return function () { return frame.fill; };
		}
		else {
			return new Error("Unsupported frame: " + frame);
		}
	},

	// Call the func for every defined location in the layout matrix.  Return an
	// object containing the color values to set for each strand.
	// TODO: plumb selection
	forEachLayoutLocation: function (layout, func) {
		var pixelColors = [];

		var context = {
			maxX: layout.dimensions[0] - 1,
			_lastDimension: 'x',
			_pixelIndicies: layout.pixelIndicies,
			_func: func,
			_output: pixelColors,
		};
		if (layout.dimensions.length > 1) {
			context._lastDimension = 'y';
			context.maxY = layout.dimensions[1] - 1;
		}
		if (layout.dimensions.length > 2) {
			context._lastDimension = 'z';
			context.maxZ = layout.dimensions[2] - 1;
		}

		this._recurse_forEachLayoutLocation('x', context);

		// Map locations to strands and populate the strand values.
		var strandsColors = {};
		_.forEach(this.config.strands, function (strand) {
			strandsColors[strand.id] = [];
			for (var pixelId = strand.start; pixelId <= strand.end; pixelId++) {
				strandsColors[strand.id].push( pixelColors[pixelId] );
			}
		});
		return strandsColors;
	},
	_recurse_forEachLayoutLocation: function (dimension, context) {
		var nextDimension = dimension == context._lastDimension ? null : dimension == 'x' ? 'y' : 'z';

		for (var i = 0; i <= context["max" + dimension.toUpperCase()]; i++) {
			var newContext = _.extend({}, context);
			newContext[dimension] = i;
			if (nextDimension !== null) {
				newContext._pixelIndicies = context._pixelIndicies[i];
				this._recurse_forEachLayoutLocation(nextDimension, newContext);
			}
			else {
				var pixelIndex = context._pixelIndicies[i];
				if (pixelIndex === null) continue;
				context._output[pixelIndex] = context._func(newContext);
			}
		}
	},
};

module.exports = Animation;
