var _ = require("lodash"),
	Timer = require("./timer"),
	Color = require("./color"),
	Exprjs = require("exprjs"),
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
		if (schemaErr !== undefined) return new Error("Invalid config: " + schemaErr.message);

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
					layout.pixelIndicies = [];
					var pixelIndex = 0;
					for (var x = 0; x < layout.dimensions[0]; x++) {
						if (dimensionSize > 1) {
							layout.pixelIndicies[x] = [];
							for (var y = 0; y < layout.dimensions[1]; y++) {
								if (dimensionSize > 2) {
									layout.pixelIndicies[x][y] = [];
									for (var z = 0; z < layout.dimensions[2]; z++) {
										layout.pixelIndicies[x][y].push(pixelIndex++);
									}
								} else {
									layout.pixelIndicies[x].push(pixelIndex++);
								}
							}
						} else {
							layout.pixelIndicies.push(pixelIndex++);
						}
					}
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
			_.forEach(config.animations, function (animation) {
				if (animation.colorspace === undefined) animation.colorspace = "RGB";
			});

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

			// Set cumulative time for each frame.
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

			// Compile frames for each playback.
			_.forEach(config.playback, function (playback, playbackIndex) {
				var animation = config.animationsById[playback.animationId],
					layout    = config.layoutsById[playback.layoutId];
				playback.compiledFrames = [];
				_.forEach(animation.frames, function (frame, frameIndex) {
					// Compile the frame
					var func = this.getRenderFramePixelFunc(frame, frameIndex, animation, layout);
					if (func instanceof Error) {
						err = "Failed to compile animationsById[" + animation.id + "].frames[" + frameIndex + "]: " + func.message;
						return false;
					}
					playback.compiledFrames.push(func);
				}, this);
				if (err !== "") return false;
			}, this);
			if (err !== "") break;

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
				repeatCount: 0,
			};
		var context = this.playbackContext[ playback.id ];

		// If playback is done, return null.
		if (context.done) return null;

		var animation = this.config.animationsById[playback.animationId],
			layout    = this.config.layoutsById[playback.layoutId];

		var selection;
		if (playback.selectionId)
			selection = this.config.selectionsById[playback.selectionId];

		// Fetch the current frame.
		var curFrame = animation.frames[context.curFrameIndex];

		var renderContext = {
			playback: playback,
		};

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
			}
			else {
				// Add a context clue for percent done with current frame.
				renderContext.percent = (elapsed - curFrame.cumulativeTime) / curFrame.time;
			}
		}

		var renderFunc = playback.compiledFrames[context.curFrameIndex];

		// Call the renderFramePixel function for each visible layout location.
		var strandsColors = this.forEachLayoutLocation(layout, selection, renderFunc, false, renderContext);

		// If the current frame is not time-based, we need to move the playback
		// index forward, and possibly loop it if we need to repeat.
		if (curFrame.time === undefined) {
			// Check if we're at the end of the playback.
			if (animation.frames[ context.curFrameIndex + 1 ] === undefined) {
				if (playback.repeat !== undefined) {
					if (playback.repeat === -1) {
						context.curFrameIndex = 0;
					}
					else if (playback.repeat > context.repeatCount) {
						context.curFrameIndex = 0;
						context.repeatCount++;
					}
					else {
						context.done = true;
					}
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

	// Return a function which, when passed an object containing variables such
	// as x, y, z, maxX, maxY, maxZ, returns a color for that pixel, based upon
	// the frame definition and optionally other parts of the config.
	getRenderFramePixelFunc: function (frame, frameIndex, animation, layout) {
		var self = this;
		if (this.isTransitionFrame(frame)) {
			var prevFrame = animation.frames[ frameIndex - 1 ],
				nextFrame = animation.frames[ frameIndex + 1 ];
			if (prevFrame === undefined || nextFrame === undefined)
				return new Error("can't be a transition without a frame before and after");
			if (this.isTransitionFrame(prevFrame) || this.isTransitionFrame(nextFrame))
				return new Error("can't transition from/to another transition")

			if (frame.dissolve) {
				return function (c) {
					var from = c.playback.compiledFrames[ frameIndex - 1 ](_.extend({ percent: 1 }, c)),
						to   = c.playback.compiledFrames[ frameIndex + 1 ](_.extend({ percent: 0 }, c));
					return from.tween(c.percent, to);
				};
			}
		}

		if (frame.fill) {
			// frame.fill is the color to return in all cases.
			var color = new Color(animation.colorspace, frame.fill);
			if (color instanceof Error) return color;
			return function () { return color };
		}
		else {
			return new Error("Unsupported frame: " + JSON.stringify(frame));
		}
	},

	// Call the func for every defined location in the layout matrix.  Return an
	// object containing the color values to set for each strand, or instead if
	// requested the pixelColors: an array indexed by the pixel index.
	forEachLayoutLocation: function (layout, selection, func, wantPixelColors, superContext) {
		var pixelColors = [];

		var context = _.extend({
			maxX: layout.dimensions[0] - 1,
			stash: {},
			_lastDimension: 'x',
			_pixelIndicies: layout.pixelIndicies,
			_func: func,
			_output: pixelColors,
		}, superContext);

		if (layout.dimensions.length > 1) {
			context._lastDimension = 'y';
			context.maxY = layout.dimensions[1] - 1;
		}
		if (layout.dimensions.length > 2) {
			context._lastDimension = 'z';
			context.maxZ = layout.dimensions[2] - 1;
		}

		if (selection) {
			var parser = new Exprjs();
			var parsed = parser.parse(selection.criteria);
			var funcs = {};
			context._selection = function (c) {
				var objs = {};
				_.forEach(c, function (val, key) {
					if (/^_/.test(key)) return;
					objs[key] = val;
				});
				return parser.run(parsed, objs, funcs);
				//return eval(selection.criteria);
			};
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
				if (context._selection && ! context._selection(newContext)) continue;
				context._output[pixelIndex] = context._func(newContext).integer();
			}
		}
	},
};

module.exports = Animation;
