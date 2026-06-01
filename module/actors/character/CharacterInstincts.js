export class CharacterInstincts {
	constructor(flags, choiceController) {
		this._flags      = flags;
		this._controller = choiceController;
	}

	get _custom() { return this._flags.getFlag("custom") ?? ""; }

	async selectOption(slug, siblingSlugsCsv) {
		await this._controller.selectOption("instinct", slug, siblingSlugsCsv);
		await this._flags.setFlag("custom", "");
	}

	async selectCustom(text) {
		await this._controller.clearValues("instinct");
		await this._flags.setFlag("custom", text);
	}

	async buildSnapshot(instinctData) {
		if (!instinctData) return { group: null, selected: null };
		await this._controller.addGroup("instinct", instinctData);
		const group = this._controller.buildGroupSnapshot("instinct");
		const checkedOption = group.list[0]?.options?.find(o => o.checked) ?? null;
		const selected = checkedOption
			? `${checkedOption.text} — ${checkedOption.description}`
			: (this._custom || null);
		return { group, selected };
	}
}
