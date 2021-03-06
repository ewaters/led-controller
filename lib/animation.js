var _ = require("lodash"),
	Timer = require("./timer"),
	Color = require("./color"),
	Gradient = require("./gradient"),
	Exprjs = require("exprjs"),
	tmp       = require("temporary"),
	ppm       = require("ppm"),
	path      = require("path"),
	spawn     = require("child_process").spawn,
	fs        = require("fs"),
	async = require("async"),
	schema = require("./schema");

function Animation (config) {
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

	compile: function (cb) {
		var config = this.config;
		var schemaErr = schema.validate(config);
		if (schemaErr !== undefined) return cb("Invalid config: " + schemaErr.message);

		var err = this.validateConfig(config);
		if (err !== undefined) return cb("Invalid config: " + err);

		// Compile frames for each playback.
		var self = this;
		var tasks = [];
		_.forEach(config.playback, function (playback) {
			var animation = config.animationsById[playback.animationId],
				layout    = config.layoutsById[playback.layoutId];
			playback.compiledFrames = [];
			_.forEach(animation.frames, function (frame, frameIndex) {
				tasks.push(function (cb) {
					// Compile the frame
					self.getRenderFrameFunc(
						{
							frame:      frame,
							frameIndex: frameIndex,
							animation:  animation,
							layout:     layout,
							playback:   playback,
						},
						function (err, func) {
							if (err !== null && err !== undefined)
								return cb("Invalid config: Failed to compile animationsById[" + animation.id + "].frames[" + frameIndex + "]: " + err);
							playback.compiledFrames.push(func);
							return async.nextTick(cb);
						}
					);
				});
			});
		});
		async.parallel(tasks, function (err) { cb(err); });
	},

	validateConfig: function (config) {
		var err = "";

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
		if (err !== "") return err;

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
			layout.locationToPixelIds = {};
			function recurse (array, dimension, breadcrumb, parentKey) {
				var i, key;
				if (array.length !== layout.dimensions[dimension - 1]) {
					return breadcrumb + ".length " + array.length + " doesn't match expected " + layout.dimensions[dimension - 1 ];
				}
				if (dimension === dimensionSize) {
					// Verify array contains only null or pixel ids.
					for (i = 0; i < array.length; i++) {
						// Construct a location key.
						if (parentKey === undefined)
							key = i;
						else
							key = parentKey + "," + i;

						if (_.isNull(array[i])) continue;
						if (! _.isNumber(array[i])) {
							return breadcrumb + "[" + i + "] is not a number ('" + array[i] + "')";
						}
						if (layout.usedPixelIds[array[i]] !== undefined) {
							return breadcrumb + "[" + i + "] references an already seen pixel id (" + array[i] + ")";
						}
						layout.usedPixelIds[array[i]] = true;
						layout.locationToPixelIds[key] = array[i];
						if (pixelIdToStrandId[array[i]] === undefined) {
							return breadcrumb + "[" + i + "] references an unknown pixel id (" + array[i] + ")";
						}
					}
				}
				else {
					// Verify array contains only layout.dimensions[dimension - 1] arrays.
					for (i = 0; i < array.length; i++) {
						if (parentKey === undefined)
							key = i;
						else
							key = parentKey + "," + i;
						if (! _.isArray(array[i])) {
							return breadcrumb + "[" + i + "] is not an array";
						}
						var result = recurse(array[i], dimension + 1, breadcrumb + "[" + i + "]", key);
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
		if (err !== "") return err;

		// Fill in default values
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
		if (err !== "") return err;

		// Check that fields named "*Id" refer to another item
		// in another section.
		_.forEach(config, function (section, sectionKey) {
			_.forEach(section, function (item, itemIndex) {
				_.forEach(item, function (value, key) {
					if (! /Id$/.test(key)) return;

					var matches = key.match(/^(.+)Id$/);
					var refSection = matches[1] + 's';
					if (config[refSection + "ById"] === undefined) {
						err = refSection + "ById doesn't exist";
						return false;
					}
					if (config[refSection + "ById"][value] === undefined) {
						err = sectionKey + "[" + itemIndex + "]." + key + " refers to an id " + value + " that's not found in " + refSection;
						return false;
					}
				});
				if (err !== "") return false;
			});
			if (err !== "") return false;
		});
		if (err !== "") return err;

		// Set cumulative time for each frame.
		_.forEach(config.animations, function (animation) {
			var cumulativeTime = 0;
			_.forEach(animation.frames, function (frame) {
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
	},

	render: function (cb) {
		if (this.renderContext === undefined)
			this.renderContext = {
				playbackIndex: 0,
			};

		_.forEach(this.config.playback, function (playback, i) {
			playback._index = i;
		});

		var self = this,
			completePlayback = false;
		async.mapSeries(this.config.playback, function (playback, cb) {
			if (playback._index < self.renderContext.playbackIndex) return async.nextTick(cb);
			if (completePlayback) return async.nextTick(cb);
			self.renderPlayback(playback, function (err, playbackResult) {
				if (err !== null) return cb(err);
				// If this playback is complete, move on to next.
				if (playbackResult === null) {
					self.renderContext.playbackIndex++;
				}
				else if (! playback.concurrentWithNext) {
					completePlayback = true;
				}
				return cb(null, playbackResult);
			});
		}, function (err, results) {
			if (err !== null) return cb(err);
			// Aggregate all playback results into a single return value.
			var aggregateResult = null;
			_.forEach(results, function (result) {
				if (result === null) return;
				_.forEach(result, function (strand, strandId) {
					for (var j = 0; j < strand.length; j++) {
						if (strand[j] === undefined || strand[j] === null) continue;
						if (aggregateResult === null) aggregateResult = {};
						if (aggregateResult[strandId] === undefined) aggregateResult[strandId] = [];
						aggregateResult[strandId][j] = strand[j];
					}
				});
			});
			return cb(null, aggregateResult);
		});
	},

	renderPlayback: function (playback, cb) {
		// Fetch a persistent context for this playback from the Animation.
		// This is what tracks how far we have progressed into the playback.
		if (this.playbackContext[ playback.id ] === undefined)
			this.playbackContext[ playback.id ] = {
				curFrameIndex: 0,
				repeatCount: 0,
			};
		var context = this.playbackContext[ playback.id ];

		// If playback is done, return null.
		if (context.done) return cb(null, null);

		// Get referenced playback objects.
		var animation = this.config.animationsById[playback.animationId],
			layout    = this.config.layoutsById[playback.layoutId];
		var selection;
		if (playback.selectionId)
			selection = this.config.selectionsById[playback.selectionId];

		var renderContext = {
			playback: playback,
		};

		// Fetch the current frame.
		var curFrame = animation.frames[context.curFrameIndex];
		if (curFrame === undefined) {
			console.info("ERROR: Found no frame at index " + context.curFrameIndex);
			return cb(null, null);
		}

		// Check to see if the current frame is time-based, and is still visible.
		// If it's not, find the next valid frame to display.
		if (curFrame.time !== undefined) {
			if (context.timer === undefined) context.timer = this.newTimer();
			var elapsed = context.timer.elapsed();
			if (playback.speed !== undefined) elapsed *= playback.speed;
			while (curFrame.time !== undefined && elapsed >= (curFrame.cumulativeTime + curFrame.time)) {
				curFrame = animation.frames[++context.curFrameIndex];
				// Check if we've now gone past the end of the animation.
				if (curFrame === undefined) {
					context.done = true;
					return cb(null, null);
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

		// Fetch the render function for the frame.
		var renderFunc = playback.compiledFrames[context.curFrameIndex];
		if (renderFunc === undefined) return cb("Invalid compiledFrame index " + context.curFrameIndex);

		// Prepare for next iteration.
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
						// Completed repeating requested times.
						context.done = true;
					}
				}
				else {
					// No repeat needed; run once.
					context.done = true;
				}
			}
			else {
				// There is a next frame; prepare for next render() call.
				context.curFrameIndex++;
			}
		}

		// Generate a selectionLookup map.
		var selectionLookup = {};
		if (selection !== undefined) {
			var parser = new Exprjs();
			var parsed = parser.parse(selection.criteria);
			var funcs = {};
			var selectionFunc = function (c) {
				// Clone c but omit the private, '_' fields.
				var objs = {};
				_.forEach(c, function (val, key) {
					if (/^_/.test(key)) return;
					objs[key] = val;
				});
				try {
					selectionLookup[c._key] = parser.run(parsed, objs, funcs);
				}
				catch (e) {
					console.info("selection[" + selection.id + "].criteria '" + selection.criteria + "' failed to run: " + e.message);
				}
			};
			this.mapFuncOverLayout(layout, selectionFunc, {});
		}

		// Call the render function, parse the output and return.
		var self = this;
		async.waterfall([
			function (cb) {
				renderFunc(renderContext, cb);
			},
			function (renderedFrame, cb) {
				var pixelColors = [], strandsColors = {};
				// Convert rendered frame { '0,0': new Color() } to be integers
				// indexed by pixel id [ 0: 0xffffff ].
				_.forEach(renderedFrame, function (color, loc) {
					if (selection !== undefined && selectionLookup[loc] === false) return;
					pixelColors[ layout.locationToPixelIds[loc] ] = color.integer();
				});
				// Convert pixel colors to strand data { 1: [ 0xffffff ] }
				_.forEach(self.config.strands, function (strand) {
					strandsColors[strand.id] = [];
					for (var pixelId = strand.start; pixelId <= strand.end; pixelId++) {
						strandsColors[strand.id].push( pixelColors[pixelId] );
					}
				});
				return cb(null, strandsColors);
			},
		], cb);
	},

	renderToAnimatedGif: function (targetLayout, fps, cb) {
		var self = this;
		var timeStep = 1 / fps;
		var frameNumber = 1;
		var backgroundColor = [0, 0, 0];

		// Create temporary staging area and plan its demise.
		var tmpDir = new tmp.Dir();
		var frameFiles = [];
		var cleanupTmpFunc = function (cb) {
			async.series([
				function (cb) {
					async.forEach(frameFiles, fs.unlink, cb);
				},
				function (cb) {
					tmpDir.rmdir(cb);
				},
			], function (err) {
				if (err !== null)
					console.error("Cleaning up temporary files encountered an error:", err);
				return cb();
			});
		};

		// Set up controllable timer.
		var timerElapsed = 0;
		this.newTimer = function () {
			return { elapsed: function () { return timerElapsed; } };
		};

		var keepRendering = true;
		var postRenderFunc = function (result, cb) {
			if (result === null) {
				keepRendering = false;
				return cb();
			};

			// Construct a filename to write to.
			var zeroPadded = frameNumber + "";
			while (zeroPadded.length != 4) {
				zeroPadded = "0" + zeroPadded;
			}
			var frameFn = path.join(tmpDir.path, "frame_" + zeroPadded + ".ppm");
			frameFiles.push(frameFn);

			// Write pixels to file.
			var colorsByPixelId = {};
			_.forEach(result, function (strandValues, strandId) {
				var pixelId = self.config.strandsById[strandId].start;
				_.forEach(strandValues, function (color) {
					colorsByPixelId[pixelId] = color;
					pixelId++;
				});
			});

			var locationToColor = {};
			_.forEach(targetLayout.locationToPixelIds, function (pixelId, location) {
				var color = colorsByPixelId[pixelId];
				if (color === undefined || color === null) return;
				locationToColor[location] = color;
			});

			var colorAtLocation = function (x, y) {
				var val = locationToColor[x + "," + y];
				if (val === undefined) return backgroundColor;
				var color = new Color("RGB", val);
				var result = [];
				["red", "green", "blue"].forEach(function (channel) {
					result.push( Math.floor(color[channel]() * 255) );
				});
				return result;
			};

			var image = [];
			for (var x = 0; x < targetLayout.dimensions[0]; x++) {
				image[x] = [];
				for (var y = 0; y < targetLayout.dimensions[1]; y++) {
					image[x][y] = colorAtLocation(x, y);
				}
			}

			ppm.serialize(image)
				.pipe(fs.createWriteStream(frameFn))
				.on("finish", function () {
					// Continue to next.
					timerElapsed += timeStep;
					frameNumber++;
					return async.nextTick(cb);
				});
		};

		var buffers = [];
		var postConvert = function (err) {
			if (err) return cb(err);
			return cb(null, Buffer.concat(buffers));
		};

		async.whilst(
			function () { return keepRendering; },
			function (cb) {
				self.render(function (err, result) {
					if (err !== null) return cb(err);
					postRenderFunc(result, cb);
				});
			},
			function (err) {
				if (err) return cb(err);
				var convert = spawn(
					"/usr/bin/convert",
					[ "-delay", Math.floor(timeStep * 100), "frame_????.ppm", "gif:-" ],
					{
						cwd: tmpDir.path,
						encoding: "binary",
					}
				);
				convert.stdout.on("data", function (data) {
					buffers.push(data);
				});
				convert.on("close", function (code) {
					async.series([
						cleanupTmpFunc,
						function (cb) {
							if (code !== 0)
								return cb("Convert returned a non-zero exit code " + code);
							if (buffers.length === 0)
								return cb("Convert returned no content");
							return cb();
						},
					], postConvert);
				});
			}
		);
	},

	isTransitionFrame: function (frame) {
		// TODO
		return frame.dissolve;
	},

	mapFuncOverLayout: function (layout, func, superContext) {
		var context = _.extend({
			maxX: layout.dimensions[0] - 1,
			_lastDimension: 'x',
			_func: func,
			_output: {},
		}, superContext);

		if (layout.dimensions.length > 1) {
			context._lastDimension = 'y';
			context.maxY = layout.dimensions[1] - 1;
		}
		if (layout.dimensions.length > 2) {
			context._lastDimension = 'z';
			context.maxZ = layout.dimensions[2] - 1;
		}

		this._mapFuncOverLayout('x', context);
		return context._output;
	},
	_mapFuncOverLayout: function (dimension, context) {
		var nextDimension = dimension === context._lastDimension ? null : dimension === 'x' ? 'y' : 'z';

		for (var i = 0; i <= context["max" + dimension.toUpperCase()]; i++) {
			var newContext = _.extend({}, context);
			newContext[dimension] = i;
			if (newContext._key === undefined)
				newContext._key = i;
			else
				newContext._key += "," + i;

			if (nextDimension !== null) {
				this._mapFuncOverLayout(nextDimension, newContext);
			}
			else {
				context._output[newContext._key] = context._func(newContext);
			}
		}
	},

	getRenderFrameFunc: function (opt, cb) {
		var frame      = opt.frame,
			frameIndex = opt.frameIndex,
			animation  = opt.animation,
			layout     = opt.layout;

		if (this.isTransitionFrame(frame)) {
			var prevFrame = animation.frames[ frameIndex - 1 ],
				nextFrame = animation.frames[ frameIndex + 1 ];
			if (prevFrame === undefined || nextFrame === undefined)
				return cb("can't be a transition without a frame before and after");
			if (this.isTransitionFrame(prevFrame) || this.isTransitionFrame(nextFrame))
				return cb("can't transition from/to another transition");

			if (frame.dissolve) {
				return cb(null, function (c, cb) {
					var fromFunc = c.playback.compiledFrames[ frameIndex - 1 ],
						toFunc   = c.playback.compiledFrames[ frameIndex + 1 ];
					async.parallel([
						function (cb) {
							fromFunc(_.extend({ percent: 1 }, c), cb);
						},
						function (cb) {
							toFunc(_.extend({ percent: 0 }, c), cb);
						},
					], function (err, results) {
						var fromColors = results[0],
							toColors   = results[1];
						var result = {};
						_.forEach(fromColors, function (from, key) {
							result[key] = from.tween(c.percent, toColors[key]);
						});
						return cb(null, result);
					});
				});
			}
		}

		var color;
		if (frame.fill !== undefined) {
			// frame.fill is the color to return in all cases.
			color = new Color(animation.colorspace, frame.fill);
			if (color instanceof Error) return cb(color.message);
			var result = this.mapFuncOverLayout(layout, function () { return color; }, {});
			return cb(null, function (c, cb) {
				return cb(null, result);
			});
		}
		else if (frame.gradient) {
			// Construct arguments for new Gradient()
			var gradOpts = {
				size: layout.dimensions,
				colors: [],
			};
			for (var i = 0; i < frame.gradient.length; i++) {
				var item = frame.gradient[i];
				color = new Color(animation.colorspace, frame.gradient[i].color);
				if (color instanceof Error) return cb(color.message);
				gradOpts.colors.push({
					x: item.xPercent === undefined ? 0 : item.xPercent * (layout.dimensions[0] - 1),
					y: item.yPercent === undefined ? 0 : item.yPercent * (layout.dimensions[1] - 1),
					color: color,
				});
			}

			// Pre-generate the full gradient.
			var gradient = new Gradient(gradOpts);
			if (gradient instanceof Error) return cb(gradient.message);
			gradient.render(function (err, result) {
				if (err !== null) return cb(err);
				return cb(null, function (c, cb) {
					return cb(null, result);
				});
			});
		}
		else {
			return cb("Unsupported frame: " + JSON.stringify(frame));
		}
	},
};

module.exports = Animation;
