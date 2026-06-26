export class CharacterOrigin {
	constructor(flags) {
		this._flags = flags;
	}

	get selected() {
		return this._flags.getFlag("selected") ?? "";
	}

	async select(region) {
		await this._flags.setFlag("selected", region);
	}
}
