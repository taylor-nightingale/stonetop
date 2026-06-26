export class CharacterInstincts {
	constructor(flags) {
		this._flags = flags;
	}

	get selectedValue() {
		return this._flags.getFlag("selected") ?? "";
	}

	async select(value) {
		await this._flags.setFlag("selected", value);
	}
}
