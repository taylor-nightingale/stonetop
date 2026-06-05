export class FakePoolRollBuilder {
	_groups = [];
	_total  = 0;

	withKeptGroup(...values)    { this._groups.push({ values, kept: true  }); return this; }
	withDroppedGroup(...values) { this._groups.push({ values, kept: false }); return this; }
	withTotal(total)            { this._total = total; return this; }

	build() {
		const results = [
			...this._groups.filter(g =>  g.kept).flatMap(g => g.values.map(v => ({ result: v, active: true  }))),
			...this._groups.filter(g => !g.kept).flatMap(g => g.values.map(v => ({ result: v, active: false }))),
		];
		return {
			dice:  [{ results }],
			total: this._total,
		};
	}
}
