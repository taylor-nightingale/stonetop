export class CharacterLore {
	constructor(flags) {
		this._flags = flags;
	}

	get counts() {
		return this._flags.getFlag("counts") ?? {};
	}

	getCount(loreSlug, optionSlug) {
		return this.counts[`${loreSlug}:${optionSlug}`] ?? 0;
	}

	async setCount(loreSlug, optionSlug, count) {
		const key = `${loreSlug}:${optionSlug}`;
		await this._flags.setFlag("counts", { ...this.counts, [key]: count });
	}

	get texts() {
		return this._flags.getFlag("texts") ?? {};
	}

	getText(loreSlug, optionSlug) {
		return this.texts[`${loreSlug}:${optionSlug}`] ?? "";
	}

	async setText(loreSlug, optionSlug, value) {
		const key = `${loreSlug}:${optionSlug}`;
		await this._flags.setFlag("texts", { ...this.texts, [key]: value });
	}
}
