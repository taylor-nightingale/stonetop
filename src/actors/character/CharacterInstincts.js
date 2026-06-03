export class CharacterInstincts {
	constructor(actor, choiceController, systemSection = "instinct") {
		this._actor      = actor;
		this._controller = choiceController;
		this._section    = systemSection;
	}

	get _custom() { return this._actor.system?.[this._section]?.custom ?? ""; }

	async selectOption(slug, siblingSlugsCsv) {
		await this._controller.selectOption("instinct", slug, siblingSlugsCsv);
		await this._actor.update({ [`system.${this._section}.custom`]: "" });
	}

	async selectCustom(text) {
		await this._controller.clearValues("instinct");
		await this._actor.update({ [`system.${this._section}.custom`]: text });
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
