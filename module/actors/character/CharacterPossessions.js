export class CharacterPossessions {
	constructor(flags) {
		this._flags = flags;
	}

	get selected()    { return new Set(this._flags.getFlag("selected") ?? []); }
	get uses()        { return this._flags.getFlag("uses") ?? {}; }
	get maxUses()     { return this._flags.getFlag("maxUses") ?? {}; }
	get subChoices()  { return this._flags.getFlag("subChoices") ?? {}; }
	get choiceUses()  { return this._flags.getFlag("choiceUses") ?? {}; }
	// Player-written "something else (discuss with GM)" possessions — items not on the
	// playbook's list, stored as { slug, label } since there's no option to match by slug.
	get custom()      { return this._flags.getFlag("custom") ?? []; }
	// Fully player-AUTHORED possessions from the "Add Custom Possession" dialog — richer than the
	// onboarding write-in: { slug, label, description, resource }. Kept in their own flag (not
	// `custom`) so the onboarding flow's whole-list `setCustom` rewrite never wipes them, and given
	// stable random slugs from the start so resource uses keyed by slug survive edits/reordering.
	get authored()    { return this._flags.getFlag("authored") ?? []; }

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

	// Replace a possession's whole sub-choice list (used when re-applying onboarding, so
	// sub-choices the player deselected are dropped rather than left behind by add-only writes).
	async setSubChoices(possessionSlug, choiceSlugs) {
		await this._flags.setFlag("subChoices", { ...this.subChoices, [possessionSlug]: [...choiceSlugs] });
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

	// Replace the whole write-in list from a set of labels, assigning each a `custom-N`
	// slug. Blank labels are dropped. Replacing (rather than appending) keeps re-running
	// onboarding idempotent: the same write-in maps back to the same single entry.
	async setCustom(labels) {
		const entries = [];
		let n = 1;
		for (const label of labels ?? []) {
			const trimmed = String(label ?? "").trim();
			if (!trimmed) continue;
			entries.push({ slug: `custom-${n}`, label: trimmed });
			n++;
		}
		await this._flags.setFlag("custom", entries);
	}

	async removeCustom(slug) {
		await this._flags.setFlag("custom", this.custom.filter(c => c.slug !== slug));
	}

	// Add or update one authored possession. A record without a slug is new (gets a stable random
	// slug); one with a slug updates the matching entry in place (preserving order). Blank labels
	// are rejected. `outfitItems` are gear the possession GRANTS — see grantedOutfitItems. Returns
	// the saved record's slug.
	async upsertAuthored({ slug, label, description = "", resource = null, outfitItems = [] } = {}) {
		const trimmed = String(label ?? "").trim();
		if (!trimmed) return null;
		const id = slug || `custom-possession-${foundry.utils.randomID()}`;
		const record = {
			slug: id,
			label: trimmed,
			description: String(description ?? ""),
			resource: resource ?? null,
			outfitItems: Array.isArray(outfitItems) ? outfitItems : [],
		};
		const list = this.authored;
		const idx = list.findIndex(c => c.slug === id);
		const next = idx >= 0
			? list.map((c, i) => (i === idx ? record : c))
			: [...list, record];
		await this._flags.setFlag("authored", next);
		return id;
	}

	async removeAuthored(slug) {
		await this._flags.setFlag("authored", this.authored.filter(c => c.slug !== slug));
	}

	// Inventory gear GRANTED by authored possessions (Taylor's nested possession→outfit-items),
	// flattened into outfit-item descriptors the inventory snapshot can run through its normal
	// mapItem builder. Derived fresh each render from the possession records, so removing a
	// possession drops its gear automatically and no separate inventory flag needs maintaining
	// (only the per-slug carried/◇ toggle lives in inventory.checked, keyed by these unique slugs).
	grantedOutfitItems() {
		return this.authored.flatMap(c => (c.outfitItems ?? []).map(oi => ({
			slug:            oi.slug,
			name:            oi.name,
			note:            oi.note ?? null,
			weight:          oi.weight ?? 0,
			resource:        null,
			twoCol:          false,
			breakBefore:     false,
			inventoryColumn: oi.inventoryColumn === "small" ? "small" : "regular",
		})));
	}
}
