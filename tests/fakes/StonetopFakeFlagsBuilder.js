import {FakeFlags} from "./foundry/FakeFlags.js";

export class StonetopFakeFlagsBuilder {
	_flags = {};

	withFlag(key, value) {
		this._flags[key] = value;
		return this;
	}

	withFlags(flags) {
		Object.assign(this._flags, flags);
		return this;
	}

	build() {
		const fakeFlags = new FakeFlags();
		for (const [key, value] of Object.entries(this._flags)) {
			fakeFlags.setFlagNonAsync("stonetop", key, value);
		}
		return fakeFlags;
	}
}
