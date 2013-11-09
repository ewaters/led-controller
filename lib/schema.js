var tv4 = require("tv4"),
	_   = require("lodash");

var types = {
	id: {
		type: "integer",
		minimum: 1,
	},
	name: {
		type: "string",
	},
};

var strand = {
	type: "object",
	required: [ "id", "start", "end" ],
	properties: {
		id: types.id,
		start: {
			type: "integer",
			minimum: 0,
		},
		end: {
			type: "integer",
			minimum: 1,
		},
	},
	additionalProperties: false,
};

var layout = {
	type: "object",
	required: [ "id", "dimensions" ],
	properties: {
		id: types.id,
		name: types.name,
		dimensions: {
			type: "array",
			items: {
				type: "integer",
				minimum: 1,
			},
		},
		pixelIndicies: {
			type: "array",
		},
	},
	additionalProperties: false,
};

var selection = {
	type: "object",
	required: [ "id", "criteria" ],
	properties: {
		id: types.id,
		name: types.name,
		criteria: {
			type: "string",
		},
	},
	additionalProperties: false,
};


var frameTypes = {
	fill: {
		type: "number",
	},
	dissolve: {
		type: "boolean",
	},
	gradient: {
		type: "array",
		items: {
			type: "object",
			patternProperties: {
				"^(x|y|z)Percent$": { type: "number" },
			},
			properties: {
				color: { type: "integer" },
			},
			required: [ "color" ],
			additionalProperties: false,
		},
		minItems: 1,
		maxItems: 3,
	},
};

var frameCommon = {
	time: {
		type: "number",
	},
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

var animation = {
	type: "object",
	required: [ "id", "frames" ],
	properties: {
		id: types.id,
		name: types.name,
		frames: {
			type: "array",
			items: frame,
			minItems: 1,
		},
	},
	additionalProperties: false,
};

var playback = {
	type: "object",
	required: [ "id", "layoutId", "animationId" ],
	properties: {
		id: types.id,
		animationId: types.id,
		layoutId: types.id,
		selectionId: types.id,
		repeat: {
			type: "integer",
		},
		speed: {
			type: "integer",
			minimum: 0,
		},
		concurrentWithNext: {
			type: "boolean",
		},
	},
	additionalProperties: false,
};

var schema = {
	type: "object",
	required: [ "strands", "layouts", "animations", "playback" ],
	properties: {
		strands: {
			type: "array",
			items: strand,
		},
		layouts: {
			type: "array",
			items: layout,
		},
		selections: {
			type: "array",
			items: selection,
		},
		animations: {
			type: "array",
			items: animation,
		},
		playback: {
			type: "array",
			items: playback,
		},
	},
	additionalProperties: false,
};

module.exports = {
	schema: schema,
	validate: function (config) {
		var valid = tv4.validate(config, schema);
		if (valid === true) return;
		return new Error(tv4.error.message + " (" + tv4.error.schemaPath + ")");
	},
};
