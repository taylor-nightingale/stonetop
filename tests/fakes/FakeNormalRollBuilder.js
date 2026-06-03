export class FakeNormalRollBuilder {
	_values = [];
	_total  = 0;

	withValues(...values) { this._values = values; return this; }
	withTotal(total)      { this._total  = total;  return this; }

	build() {
		return {
			dice:  [{ results: this._values.map(v => ({ result: v, active: true })) }],
			total: this._total,
		};
	}
}
