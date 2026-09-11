import { FakeDiceTerm } from "./foundry/FakeDiceTerm.js";

export class FakeNormalRollBuilder {
	_values = [];
	_faces  = 6;
	_total  = 0;

	withValues(...values) { this._values = values; return this; }
	withFaces(faces)      { this._faces  = faces;  return this; }
	withTotal(total)      { this._total  = total;  return this; }

	build() {
		return {
			dice:  [FakeDiceTerm.kept(this._values, this._faces)],
			total: this._total,
		};
	}
}
