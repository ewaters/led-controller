var amanda = require("amanda");

var jsonValidator = amanda("json");

var types = {
	id: {
		type: "integer",
		required: true,
		minimum: 1,
	},
	name: {
		type: "string",
		required: false,
	},
};

var strand = {
	type: "object",
	properties: {
		id: types.id,
		start: {
			type: "integer",
			required: true,
			minimum: 0,
		},
		end: {
			type: "integer",
			required: true,
			minimum: 1,
		},
	},
};

var layout = {
	type: "object",
	properties: {
		id: types.id,
		name: types.name,
		dimensions: {
			type: "array",
			required: true,
			items: {
				type: "integer",
				minimum: 1,
			},
		},
		pixelIndicies: {
			type: "array",
			required: false,
		},
	},
};

var selection = {
	type: "object",
	properties: {
		id: types.id,
		name: types.name,
	},
};

var animation = {
	type: "object",
	properties: {
		id: types.id,
		name: types.name,
		frames: {
			type: "array",
			required: true,
			items: {
				type: "object",
			},
		},
	},
};

var playback = {
	type: "object",
	properties: {
		animationId: types.id,
		layoutId: types.id,
	},
};

var schema = {
	type: "object",
	properties: {
		strands: {
			required: true,
			type: "array",
			items: strand,
		},
		layouts: {
			required: true,
			type: "array",
			items: layout,
		},
		selections: {
			type: "array",
			items: selection,
		},
		animations: {
			required: true,
			type: "array",
			items: animation,
		},
		playback: {
			required: true,
			type: "array",
			items: playback,
		},
	},
};

module.exports = {
	schema: schema,
	validate: function (config) {
		var errors;
		jsonValidator.validate(config, schema, function (err) {
			if (err === undefined) return;
			errors = err;
		});
		if (errors !== undefined) return new Error(errors.getMessages()[0]);
	},
};
