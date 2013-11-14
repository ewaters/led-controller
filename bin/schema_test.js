#!/usr/bin/env node

var _ = require("lodash"),
	console = require("console"),
	schema = require("../lib/schema");

var RED = 0xff0000;

var config = {
	strands: [
		{
			id: 1,
			start: 0,
			end: 3,
		},
	],
	layouts: [
		{
			id: 1,
			dimensions: [ 2, 2 ],
			pixelIndicies: [
				[ 0, 1 ],
				[ 2, 3 ],
			],
		},
	],
	animations: [
		{
			id: 1,
			frames: [
				{
					fill: RED
				},
			]
		},
	],
	playback: [{
		animationId: 1,
		layoutId: 1,
	}],
};


var err;
err = schema.validate(config);
if (err !== undefined) {
	console.info(err.message);
}
