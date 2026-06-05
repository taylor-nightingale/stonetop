export class FakeRoll {
	static lastInstance = null;
	static _nextTotal = 7;

	constructor(formula) {
		this.formula = formula;
		this.total = FakeRoll._nextTotal;
		this.terms = [];
		this.dice = [];
		this._messageArgs = null;
		FakeRoll.lastInstance = this;
	}

	async evaluate() {
		return this;
	}

	async toMessage(args) {
		this._messageArgs = args;
	}

	static setNextTotal(n) {
		FakeRoll._nextTotal = n;
	}

	static reset() {
		FakeRoll.lastInstance = null;
		FakeRoll._nextTotal = 7;
	}
}
