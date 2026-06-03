export class FakePoolRollBuilder {
	_groups = [];
	_total  = 0;

	withKeptGroup(...values)    { this._groups.push({ values, kept: true  }); return this; }
	withDroppedGroup(...values) { this._groups.push({ values, kept: false }); return this; }
	withTotal(total)            { this._total = total; return this; }

	build() {
		const poolTerm = {
			rolls: this._groups.map(g => ({
				dice: [{ results: g.values.map(v => ({ result: v, active: true })) }],
			})),
			results: this._groups.map(g => ({
				result: g.values.reduce((s, v) => s + v, 0),
				active: g.kept,
			})),
		};
		return {
			terms: [poolTerm],
			dice:  poolTerm.rolls.flatMap(r => r.dice),
			total: this._total,
		};
	}
}
