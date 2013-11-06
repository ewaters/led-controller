var tv4 = require("tv4"),
	_      = require("lodash");

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


var frameTypes = {
	fill: {
		type: "number",
	}
};

var frameCommon = {
};

var frame = {
	type: "object",
	oneOf: [],
};
_.forEach(frameTypes, function (props, type) {
	var properties = _.extend({}, frameCommon);
	properties[type] = props;
	frame.oneOf.push({
		type: "object",
		properties: properties,
		additionalProperties: false,
	});
});
//console.info(JSON.stringify(frame));

var animation = {
	type: "object",
	properties: {
		id: types.id,
		name: types.name,
		frames: {
			type: "array",
			required: true,
			items: frame,
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
		var valid = tv4.validate(config, schema);
		if (valid === true) return;
		return new Error(tv4.error.message + " (" + tv4.error.schemaPath + ")");
	},
};
