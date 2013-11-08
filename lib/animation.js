var _ = require("lodash"),
	Timer = require("./timer"),
	Color = require("./color"),
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

	newTimer: function () {
		return new Timer();
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

				if (dimensionSize === 0 || dimensionSize > 3) {
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
					var i;
					if (array.length != layout.dimensions[dimension - 1]) {
						return breadcrumb + ".length " + array.length + " doesn't match expected " + layout.dimensions[dimension - 1 ];
					}
					if (dimension === dimensionSize) {
						// Verify array contains only null or pixel ids.
						for (i = 0; i < array.length; i++) {
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
						for (i = 0; i < array.length; i++) {
							if (! _.isArray(array[i])) {
								return breadcrumb + "[" + i + "] is not an array";
							}
							var result = recurse(array[i], dimension + 1, breadcrumb + "[" + i + "]");
							if (result !== undefined) return result;
						}
					}
				}
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
			if (err !== "") break;

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
				if (err !== "") return false;
			});
			if (err !== "") break;

			// Validate animations.
			_.forEach(config.animations, function (animation, index) {
				var cumulativeTime = 0;
				_.forEach(animation.frames, function (frame, frameIndex) {
					// Populate cumulativeTime of sequences of frames with 'time' set.
					if (frame.time !== undefined) {
						frame.cumulativeTime = cumulativeTime;
						cumulativeTime += frame.time;
					}
					else {
						cumulativeTime = 0;
					}
				});
			});

			break;
		}
		if (err !== "") return new Error("Invalid config: " + err);
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
			if (context.timer === undefined) context.timer = this.newTimer();
			var elapsed = context.timer.elapsed();
			while (curFrame.time !== undefined && elapsed >= (curFrame.cumulativeTime + curFrame.time)) {
				curFrame = animation.frames[++context.curFrameIndex];
				// Check if we've now gone past the end of the animation.
				if (curFrame === undefined) {
					context.done = true;
					return null;
				}
			}
			if (curFrame.time === undefined) {
				// If we're now showing a non-time-based frame, delete the timer.
				delete context.timer;
				delete context.percent;
			}
			else {
				// Add a context clue for percent done with current frame.
				context.percent = (elapsed - curFrame.cumulativeTime) / curFrame.time;
			}
		}

		// Fetch a function to call for each x(,y)(,z) location in the layout matrix.
		var renderFunc = this.getRenderFramePixelFunc(curFrame, playback);
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

	isTransitionFrame: function (frame) {
		// TODO
		return frame.dissolve;
	},

	renderStaticFrame: function (frame, playback) {
		var layout = this.config.layoutsById[playback.layoutId];
		var func = this.getRenderFramePixelFunc(frame, playback);
		if (func instanceof Error) return func;
		return this.forEachLayoutLocation(layout, func, true);
	},

	// Return a function which, when passed an object containing variables such
	// as x, y, z, maxX, maxY, maxZ, returns a color for that pixel, based upon
	// the frame definition and optionally other parts of the config.
	getRenderFramePixelFunc: function (frame, playback) {
		if (this.isTransitionFrame(frame)) {
			var context   = this.playbackContext[playback.id],
				animation = this.config.animationsById[playback.animationId],
				prevFrame = animation.frames[ context.curFrameIndex - 1 ],
				nextFrame = animation.frames[ context.curFrameIndex + 1 ];
			if (prevFrame === undefined || nextFrame === undefined)
				return new Error("frame " + context.curFrameIndex + " can't be a transition without a frame before and after");
			if (this.isTransitionFrame(prevFrame) || this.isTransitionFrame(nextFrame))
				return new Error("frame " + context.curFrameIndex + " can't transition from/to another transition")

			// Render the prev and next frame once.
			var prevPixelColors = this.renderStaticFrame(prevFrame, playback),
				nextPixelColors = this.renderStaticFrame(nextFrame, playback);
			if (prevPixelColors instanceof Error) return prevPixelColors;
			if (nextPixelColors instanceof Error) return nextPixelColors;

			return function (c) {
				var from = prevPixelColors[c.pixelIndex],
					to   = nextPixelColors[c.pixelIndex];
				//console.info("From " + from + " to " + to + " for index " + c.pixelIndex + " at " + context.percent);
				var tween = new Color("RGB", from).tween(context.percent, new Color("RGB", to));
				return tween.integer();
			};
		}

		if (frame.fill) {
			// frame.fill is the color to return in all cases.
			return function () { return frame.fill; };
		}
		else {
			return new Error("Unsupported frame: " + JSON.stringify(frame));
		}
	},

	// Call the func for every defined location in the layout matrix.  Return an
	// object containing the color values to set for each strand, or instead if
	// requested the pixelColors: an array indexed by the pixel index.
	// TODO: plumb selection
	forEachLayoutLocation: function (layout, func, wantPixelColors) {
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
		if (wantPixelColors) return pixelColors;

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
				newContext.pixelIndex = pixelIndex;
				context._output[pixelIndex] = context._func(newContext);
			}
		}
	},
};

module.exports = Animation;
