export class FakeFlags {
	constructor() {
		this.storage = {};
	}

	async setFlag(scope, key, value) {
		this.setFlagNonAsync(scope, key, value);
	}

	setFlagNonAsync(scope, key, value) {
		// if (value !== null && typeof value === 'object') {
		// 	const isPOJO =
		// 		Object.getPrototypeOf(value) === Object.prototype ||
		// 		Object.getPrototypeOf(value) === null;
		//
		// 	// Also check if it has any own properties that are functions (methods)
		// 	const hasMethods = Object.values(value).some(v => typeof v === 'function');
		//
		// 	if (!isPOJO || hasMethods) {
		// 		throw new Error(
		// 			`FakeFlags Error: Cannot save non-POJO to flag '${key}'. ` +
		// 			`Received: ${value.constructor?.name || 'Unknown'} (with methods: ${hasMethods}). ` +
		// 			`Did you forget to convert the class instance to a plain object?`
		// 		);
		// 	}
		// }

		// SIMULATE: Convert to JSON string and back to a plain object
		// This strips out methods and class constructors, leaving only data properties
		try {
			const plainData = JSON.parse(JSON.stringify(value));
			if (!this.storage[scope]) this.storage[scope] = {};
			this.storage[scope][key] = plainData;
		} catch (e) {
			console.error("Failed to serialize flag value:", e);
			// Fallback to empty object if serialization fails (common with circular refs or functions)
			if (!this.storage[scope]) this.storage[scope] = {};
			this.storage[scope][key] = {};
		}
	}

	getFlag(scope, key) {
		if (!this.storage[scope]) this.storage[scope] = {};
		return this.storage[scope][key] ?? null;
	}

	clear() {
		this.storage = {};
	}
}
