export class FakePlaybook {
	constructor(specialPossessions = null) {
		this._specialPossessions = specialPossessions;
	}

	async getData() {
		return this._specialPossessions ? { specialPossessions: this._specialPossessions } : null;
	}
}
