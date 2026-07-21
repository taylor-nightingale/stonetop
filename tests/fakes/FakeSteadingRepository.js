import { StonetopSteading } from "../../src/actors/steading/StonetopSteading.js";

// The world's primary steading as the character side sees it: one typed actor, or none at all.
// `withSteading` wraps a bare doc in the REAL StonetopSteading so tests exercise the same accessors
// production does (prosperity, isLacking, resolveBonus) rather than a hand-stubbed shape.
export class FakeSteadingRepository {
	constructor(steading = null) {
		this._steading = steading;
	}

	static withSteading({ name = "Stonetop", attributes = {}, debilities = {} } = {}) {
		return new FakeSteadingRepository(new StonetopSteading({ name, system: { attributes, debilities } }));
	}

	getPrimary() {
		return this._steading;
	}
}
