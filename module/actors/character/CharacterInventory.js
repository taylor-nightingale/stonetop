export class CharacterInventory {
	constructor(flags) {
		this._flags = flags;
	}

	get checked()      { return this._flags.getFlag("checked") ?? {}; }
	get resources()    { return this._flags.getFlag("resources") ?? {}; }
	get addedSpecial() { return this._flags.getFlag("addedSpecial") ?? []; }
	get regularPool()  { return this._flags.getFlag("regularPool") ?? 0; }
	get smallPool()    { return this._flags.getFlag("smallPool") ?? 0; }
	// Per-item record of how many undefined ◇/□ a Have-What-You-Need mark drew from
	// the reserve, keyed by slug. Lets un-marking return exactly what was spent
	// instead of the item's full cost (which would invent marks). Items defined at
	// Outfit have no entry, so un-marking them just drops their weight from the load.
	get drawn()        { return this._flags.getFlag("drawn") ?? {}; }

	async setItemChecked(slug, isChecked) {
		await this._flags.setFlag("checked", { ...this.checked, [slug]: isChecked });
	}

	async setResource(slug, count) {
		await this._flags.setFlag("resources", { ...this.resources, [slug]: count });
	}

	async setRegularPool(count) {
		await this._flags.setFlag("regularPool", count);
	}

	async setSmallPool(count) {
		await this._flags.setFlag("smallPool", count);
	}

	async setDrawn(drawnMap) {
		await this._flags.setFlag("drawn", drawnMap);
	}

	async setAllChecked(checkedMap) {
		await this._flags.setFlag("checked", { ...this.checked, ...checkedMap });
	}

	async addSpecial(slug) {
		if (this.addedSpecial.includes(slug)) return;
		await this._flags.setFlag("addedSpecial", [...this.addedSpecial, slug]);
	}

	async removeSpecial(slug) {
		await this._flags.setFlag("addedSpecial", this.addedSpecial.filter(s => s !== slug));
		// Clear its carried/checked state so a removed item no longer counts toward load or armor.
		if (slug in this.checked) {
			const next = { ...this.checked };
			delete next[slug];
			await this._flags.setFlag("checked", next);
		}
	}

	// Clears item marks, both undefined ◇/□ reserves (which is what drives the
	// derived load), and the per-item draw records. Item uses (resources) and
	// added-special items are left alone.
	async resetSelections() {
		await Promise.all([
			this._flags.unsetFlag("checked"),
			this._flags.unsetFlag("regularPool"),
			this._flags.unsetFlag("smallPool"),
			this._flags.unsetFlag("drawn"),
		]);
	}

	calculateArmor(allItems) {
		const equipped  = allItems.filter(item => this.checked[item.slug] && item.armor);
		const bases     = equipped.filter(i => i.armor.base     != null).map(i => i.armor.base);
		const modifiers = equipped.filter(i => i.armor.modifier != null).map(i => i.armor.modifier);
		const base = bases.length > 0 ? Math.max(...bases) : 0;
		return base + modifiers.reduce((s, m) => s + m, 0);
	}
}
