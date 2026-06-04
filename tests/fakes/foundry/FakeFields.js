function resolveInitial(initial) {
	return typeof initial === "function" ? initial() : initial;
}

export class NumberField {
	constructor(options = {}) {
		this._options = options;
	}

	initialize(value) {
		const { initial, min, max, integer, nullable } = this._options;
		if (value === null && nullable) return null;
		if (value === undefined || value === null) {
			const resolved = resolveInitial(initial);
			if (resolved === null && nullable) return null;
			let n = Number(resolved ?? 0);
			if (min !== undefined && n < min) n = min;
			if (max !== undefined && n > max) n = max;
			if (integer) n = Math.trunc(n);
			return n;
		}
		let n = Number(value);
		if (min !== undefined && n < min) n = min;
		if (max !== undefined && n > max) n = max;
		if (integer) n = Math.trunc(n);
		return n;
	}
}

export class StringField {
	constructor(options = {}) {
		this._options = options;
	}

	initialize(value) {
		const { initial, nullable } = this._options;
		if (value === null && nullable) return null;
		if (value === undefined || value === null) {
			const resolved = resolveInitial(initial);
			if (resolved === null && nullable) return null;
			return resolved ?? "";
		}
		return String(value);
	}
}

export class BooleanField {
	constructor(options = {}) {
		this._options = options;
	}

	initialize(value) {
		const { initial } = this._options;
		if (value === undefined || value === null) {
			return resolveInitial(initial) ?? false;
		}
		return Boolean(value);
	}
}

export class ObjectField {
	constructor(options = {}) {
		this._options = options;
	}

	initialize(value) {
		const { initial, nullable } = this._options;
		if (value === null && nullable) return null;
		if (value === undefined || value === null) {
			const resolved = resolveInitial(initial);
			if (resolved === null && nullable) return null;
			return resolved ?? {};
		}
		return value;
	}
}

export class ArrayField {
	constructor(elementField, options = {}) {
		this._elementField = elementField;
		this._options = options;
	}

	initialize(value) {
		if (!Array.isArray(value)) {
			return resolveInitial(this._options.initial) ?? [];
		}
		return value.map(v => this._elementField.initialize(v));
	}
}

export class SchemaField {
	constructor(schema, options = {}) {
		this._schema = schema;
		this._options = options;
	}

	initialize(value) {
		const result = {};
		for (const [key, field] of Object.entries(this._schema)) {
			result[key] = field.initialize(value?.[key]);
		}
		return result;
	}
}
