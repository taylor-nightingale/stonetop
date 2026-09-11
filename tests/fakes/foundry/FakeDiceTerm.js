/**
 * A fake of Foundry's DiceTerm, as the roll card reads one.
 *
 * The card asks the dice about themselves through `getTooltipData()` — core's own method, whose
 * classes carry the die's size, its min/max face and whether a keep-modifier discarded it. A fake
 * that answered with bare numbers instead would let a card that shows nothing of that pass.
 */
export class FakeDiceTerm {
	constructor({ faces = 6, results = [] } = {}) {
		this.faces = faces;
		this.results = results;
	}

	/** What the term came to: the dice it kept, which is not every die it rolled. */
	get total() {
		return this.results.filter(r => r.active).reduce((sum, r) => sum + r.result, 0);
	}

	getTooltipData() {
		return {
			total: this.total,
			faces: this.faces,
			formula: `${this.results.length}d${this.faces}`,
			rolls: this.results.map(r => ({ result: String(r.result), classes: this._classesFor(r) })),
		};
	}

	_classesFor(r) {
		return ["die", `d${this.faces}`,
			r.active ? null : "discarded",
			r.result === 1 ? "min" : null,
			r.result === this.faces ? "max" : null,
		].filter(Boolean).join(" ");
	}

	/** One term of `n` dice, all kept — the shape of every roll that drops nothing. */
	static kept(values, faces = 6) {
		return new FakeDiceTerm({ faces, results: values.map(result => ({ result, active: true })) });
	}
}
