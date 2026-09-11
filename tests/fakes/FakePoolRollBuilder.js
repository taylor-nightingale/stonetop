import { FakeDiceTerm } from "./foundry/FakeDiceTerm.js";

/**
 * A pool that keeps some of its dice and discards the rest — 3d6kh2 and 3d6kl2.
 *
 * ONE term, with the discarded dice marked in place: that is how core evaluates a keep-modifier, and
 * where a die fell in the pool is part of what the table watched it do.
 */
export class FakePoolRollBuilder {
	_results = [];
	_faces   = 6;
	_total   = 0;

	withKeptGroup(...values)    { return this._add(values, true); }
	withDroppedGroup(...values) { return this._add(values, false); }
	withFaces(faces)            { this._faces = faces; return this; }
	withTotal(total)            { this._total = total; return this; }

	_add(values, active) {
		this._results.push(...values.map(result => ({ result, active })));
		return this;
	}

	build() {
		return {
			dice:  [new FakeDiceTerm({ faces: this._faces, results: this._results })],
			total: this._total,
		};
	}
}
