export class CharacterInventory {
	constructor(flags) {
		this._flags = flags;
	}

	get checked()      { return this._flags.getFlag("checked") ?? {}; }
	get resources()    { return this._flags.getFlag("resources") ?? {}; }
	get loadLevel()    { return this._flags.getFlag("loadLevel") ?? null; }
	get regularPool()  { return this._flags.getFlag("regularPool") ?? 0; }
	get smallPool()    { return this._flags.getFlag("smallPool") ?? 0; }

	async setItemChecked(slug, isChecked) {
		await this._flags.setFlag("checked", { ...this.checked, [slug]: isChecked });
	}

	async setResource(slug, count) {
		await this._flags.setFlag("resources", { ...this.resources, [slug]: count });
	}

	async setLoadLevel(level) {
		await this._flags.setFlag("loadLevel", level);
	}

	async setRegularPool(count) {
		await this._flags.setFlag("regularPool", count);
	}

	async setSmallPool(count) {
		await this._flags.setFlag("smallPool", count);
	}

	calculateArmor(allItems) {
		const equipped  = allItems.filter(item => this.checked[item.slug] && item.armor);
		const bases     = equipped.filter(i => i.armor.base     != null).map(i => i.armor.base);
		const modifiers = equipped.filter(i => i.armor.modifier != null).map(i => i.armor.modifier);
		const base = bases.length > 0 ? Math.max(...bases) : 0;
		return base + modifiers.reduce((s, m) => s + m, 0);
	}
}
