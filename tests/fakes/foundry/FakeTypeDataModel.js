export class TypeDataModel {
	static defineSchema() { return {}; }
	static migrateData(data) { return data; }

	constructor(data = {}) {
		const migrated = this.constructor.migrateData({ ...data });
		this._source = _applySchema(this.constructor.defineSchema(), migrated);
		_copyToSelf(this, this._source);
		this.prepareDerivedData();
	}

	prepareDerivedData() {}

	toObject() {
		return JSON.parse(JSON.stringify(this._source));
	}
}

function _applySchema(schema, data) {
	const result = {};
	for (const [key, field] of Object.entries(schema)) {
		result[key] = field.initialize(data?.[key]);
	}
	return result;
}

function _copyToSelf(target, source) {
	for (const [key, value] of Object.entries(source)) {
		target[key] = value;
	}
}
