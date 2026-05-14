export class CharacterPossessions {
	constructor(flags) {
		this._flags = flags;
	}

	get selected()    { return new Set(this._flags.getFlag("selected") ?? []); }
	get uses()        { return this._flags.getFlag("uses") ?? {}; }
	get maxUses()     { return this._flags.getFlag("maxUses") ?? {}; }
	get subChoices()  { return this._flags.getFlag("subChoices") ?? {}; }
	get choiceUses()  { return this._flags.getFlag("choiceUses") ?? {}; }

	async select(slug) {
		const s = this.selected;
		s.add(slug);
		await this._flags.setFlag("selected", [...s]);
	}

	async deselect(slug) {
		const s = this.selected;
		s.delete(slug);
		await this._flags.setFlag("selected", [...s]);
	}

	async setUses(slug, count) {
		await this._flags.setFlag("uses", { ...this.uses, [slug]: count });
	}

	async addSubChoice(possessionSlug, choiceSlug) {
		const current = this.subChoices;
		const existing = current[possessionSlug] ?? [];
		if (existing.includes(choiceSlug)) return;
		await this._flags.setFlag("subChoices", { ...current, [possessionSlug]: [...existing, choiceSlug] });
	}

	async removeSubChoice(possessionSlug, choiceSlug) {
		const current = this.subChoices;
		const existing = current[possessionSlug] ?? [];
		await this._flags.setFlag("subChoices", { ...current, [possessionSlug]: existing.filter(s => s !== choiceSlug) });
	}

	async selectExclusive(possessionSlug, choiceSlug, exclusiveSlugs) {
		const current = this.subChoices;
		const existing = current[possessionSlug] ?? [];
		const filtered = existing.filter(s => !exclusiveSlugs.includes(s));
		const updated = filtered.includes(choiceSlug) ? filtered : [...filtered, choiceSlug];
		await this._flags.setFlag("subChoices", { ...current, [possessionSlug]: updated });
	}

	async setChoiceUses(possessionSlug, choiceSlug, count) {
		const key = `${possessionSlug}:${choiceSlug}`;
		await this._flags.setFlag("choiceUses", { ...this.choiceUses, [key]: count });
	}
}
