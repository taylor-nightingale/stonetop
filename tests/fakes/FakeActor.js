import { FakeFlags } from "./FakeFlags.js";

function applyDotPath(target, path, value) {
	const parts = path.split(".");
	let obj = target;
	for (let i = 0; i < parts.length - 1; i++) {
		if (obj[parts[i]] === undefined || obj[parts[i]] === null) {
			obj[parts[i]] = {};
		}
		obj = obj[parts[i]];
	}
	obj[parts[parts.length - 1]] = value;
}

export class FakeActor {
	constructor(attrs = {}) {
		this._flags = new FakeFlags();
		this.system = { attributes: structuredClone(attrs) };
	}

	update(data) {
		for (const [path, value] of Object.entries(data)) {
			applyDotPath(this, path, value);
		}
	}

	getFlag(scope, key) {
		return this._flags.getFlag(scope, key);
	}

	setFlag(scope, key, value) {
		return this._flags.setFlag(scope, key, value);
	}
}
