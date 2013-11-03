{
	/*
	 * Strands provides the pixel indicies for the layout.  There should be one
	 * strand per real world physical strand of serially connected LED pixels.
	 * The start and end values provide the IDs of the pixels found in the strand.
	 * You must start with 0 and have no gaps or overlaps.
	 */
	strands: [
		{
			id: 1,
			start: 0,
			end: 49,
		},
	],

	/*
	 * A layout describes which LED pixels will be used to playback the animation.
	 * 
	 * You indicate the dimensions of a matrix which will be used to render fills
	 * and gradients in the animation.  Up to three dimensions are supported (an
	 * LED cube, for instance).  Provide [ X ] for 1D, [ X, Y ] for 2D, and for 3D
	 * [ X, Y, Z ].
	 *
	 * You may optionally indicate the physical location corresponding to the 
	 * location in the matrix by specifying a dimensional matrix providing a
	 * mapping, as pixelIndicies.  Here's an example:
	 *
	 *   dimensions: [ 2, 3 ],
	 *   pixelIndicies: [
	 *   	[ 0, 1, 2 ],
	 *   	[ 3, 4, 5 ],
	 *   ],
	 *
	 * If you need to set the color of the matrix location [1, 2] (zero based),
	 * this corresponds to pixel index 5.
	 *
	 * If you don't fill in the pixelIndicies, it takes the following default value,
	 * ignoring dimensions that aren't specificied:
	 *
	 *   idx = 0
	 *   for (dimX = 0; dimX < dimensions[0], dimX++) {
	 *     for (dimY = 0; dimY < dimensions[1], dimY++) {
	 *       for (dimZ = 0; dimZ < dimensions[2], dimZ++) {
	 *         pixelIndicies[dimX, dimY, dimZ] = idx++
	 *       }
	 *     }
	 *   }
	 *
	 * Pixel index values must be found in a defined strand.  A layout may not
	 * contain more than one occurance of a pixel index.
	 *
	 * Multiple animations may playback simultaneously, allowing you to create
	 * different layouts to select different pixels to control.
	 *
	 */
	layouts: [
		{
			id: 1,
			name: "panel",
			dimensions: [ 10, 5 ],
			pixelIndicies: [
				[ 0, 1, 2, 3, 4 ],
				[ 9, 8, 7, 6, 5 ],
				[ 10, 11, 12, 13, 14 ],
				[ 19, 18, 17, 16, 15 ],
				[ 20, 21, 22, 23, 24 ],
				[ 29, 28, 27, 26, 25 ],
				[ 30, 31, 32, 33, 34 ],
				[ 39, 38, 37, 36, 35 ],
				[ 40, 41, 42, 43, 44 ],
				[ 49, 48, 47, 46, 45 ],
			],
		},
		{
			id: 2,
			name: "snake",
			dimensions: [ 50 ],
		},
	],

	/*
	 * A selection is a mask of a layout.  It allows you to easily select parts
	 * of a layout where an animation will playback without having to create the
	 * full pixelIndicies matrix for each selection.  Selections are generic and
	 * can be applied to any layout of the matching dimension size.  They can
	 * also be inverted and combined, allowing for complex animations without
	 * extensive layout manipulation.
	 *
	 * The criteria argument is a SQL-like statement that is evaluated per defined
	 * pixel of a layout.  You may use basic boolean operators (&& || ! < <= > >=)
	 * and parentheses to construct a series of conditional statements.  A statement
	 * may use basic math operators "+", "-", "/", "%", and "==" and the variables
	 * "x", "y", "z" (corresponding to the current position in the layout matrix)
	 * and "maxX", "maxY", "maxZ" (corresponding to the bounds of the layout).
	 *
	 * Pixels that match on the criteria will be part of the selection.
	 *
	 */
	selections: [
		{
			id: 1,
			name: "border",
			dimensions: 2,
			criteria: "x == 0 || x == maxX || y == 0 || y == maxY",
		},
		{
			id: 2,
			name: "leftSide",
			dimensions: 2,
			criteria: "x <= (maxX / 2)",
		},
	],


	/*
	 * Animations contains a list of all the possible animations that could be
	 * played back.  These are defined separately from the actual playback
	 * sequence to allow for animations to be played back simultaneously and to
	 * contain references to other animations.
	 *
	 * Animations are keyed on the id given.
	 *
	 */
	animations: [
		{
			id: 1,

			// Name is optional and only used for storage and for user convenience.
			name: "spinning rainbow",

			// All colors are to be interpreted as a 24bit RGB value.
			colorspace: "RGB",

			/*
			 * Here we define three different frames and transitions between them.
			 */
			frames: [
				{
					linearGradient: {
						colors: [
							{ percent: 0, color: 0xFF0000 },
							{ percent: 100, color: 0x00FF00 }
						],
						angle: 0
					},
					time: 10
				},
				{
					pushWipe: "fromRight",
					time: 5
				},
				{
					linearGradient: {
						colors: [
							{ percent: 0, color: 0x00FF00 },
							{ percent: 100, color: 0x0000FF }
						],
						angle: 0
					},
					time: 10
				},
				{
					pushWipe: "fromRight",
					time: 5
				},
				{
					linearGradient: {
						colors: [
							{ percent: 0, color: 0x0000FF },
							{ percent: 100, color: 0xFF0000 }
						],
						angle: 0
					},
					time: 10
				},
				{
					pushWipe: "fromRight",
					time: 5
				}
			]
		},
		{
			id: 2,
			name: "changing colors",
			frames: [
				{
					fill: 0xee44aa,
					time: 5
				},
				{
					dissolve: true,
					time: 5,
				},
				{
					fill: 0xface00,
					time: 5
				}
			]
		},
		{
			id: 3,
			name: "spinning colors",
			frames: [
				{
					linearGradient: {
						colors: [
							{ percent: 0, color: 0x000000 },
							{ percent: 100, color: 0xffffff }
						],
						angleTween: [ 0, 360 ]
					},
					time: 15
				}
			]
		}
	],

	playback: [
		{
			// Playback "spinning rainbow".
			animationId: 1,
			// Render onto the 2D grid of pixels.
			layoutId: 2,
			// Animation will loop infintely.
			repeat: -1,
			// Timing in the animation will be 1sec.
			speed: 1,
		},
	],
}

