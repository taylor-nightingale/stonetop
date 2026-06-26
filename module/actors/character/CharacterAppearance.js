export class CharacterAppearance {
	constructor(flags) {
		this._flags = flags;
	}

	get saved() {
		return this._flags.getFlag("selected") ?? {};
	}

	async select(lineIdx, value) {
		const current = this.saved;
		await this._flags.setFlag("selected", { ...current, [lineIdx]: value });
	}
}
