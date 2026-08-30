/**
 * One steading rating, as the game defines it rather than as a sheet draws it.
 *
 * A rating is either NUMERIC (Fortunes, Surplus, Population, Prosperity, Defenses — the stored
 * value is the number itself) or NAMED (Size — the stored value is a tier string). Both kinds
 * answer the same questions, so a caller never has to branch on which it is holding.
 *
 * Tier words live here as i18n KEYS, not text: this is module-level data built before
 * `game.i18n` exists, so nothing is resolved until something asks. That is also what makes the
 * word for a value reachable without parsing it back out of a display string.
 */
export class RatingDefinition {
	constructor(slug, { titleKey, shortTitleKey = null, badge = null, bonuses = null, values = null, tierKeys = null, bandKeys = null, min = null, max = null } = {}) {
		this.slug          = slug;
		this.titleKey      = titleKey;
		this.shortTitleKey = shortTitleKey;
		// The book crowns two of the six with an illustrated arch and gives the rest a plain rule.
		// A store path, not a shipped asset: it is a copyrighted illustration, so it is null in any
		// world whose owner hasn't installed it from their own book.
		this.badge         = badge;
		this.tierKeys = tierKeys;
		this.bandKeys = bandKeys;
		this._bonuses = bonuses;
		this._values  = values;
		this._min     = min;
		this._max     = max;
	}

	get title() {
		return game.i18n.localize(this.titleKey);
	}

	/** The label where a line has no room for the whole word. Visual only — see the tile partial. */
	get shortTitle() {
		return game.i18n.localize(this.shortTitleKey ?? this.titleKey);
	}

	/** The stored values in the book's reading order — numbers, or Size's tier strings. */
	get values() {
		return this._values ?? this._bonuses ?? [];
	}

	/** Kept so the ±N ratings can still be addressed by their game-facing name. */
	get bonuses() {
		return this._bonuses ?? [];
	}

	/** Numeric ratings step; named ones are picked from a list. */
	get isNumeric() {
		return this._values == null;
	}

	// A numeric rating's ends bound its stepper. An explicit min/max wins, so Surplus can floor at
	// zero without naming a ceiling it doesn't have.
	get min() {
		if (this._min !== null) return this._min;
		return this.isNumeric && this.values.length ? this.values[0] : null;
	}

	get max() {
		if (this._max !== null) return this._max;
		return this.isNumeric && this.values.length ? this.values.at(-1) : null;
	}

	indexOf(value) {
		return this.values.indexOf(value);
	}

	/** The word the book gives this value — "strong", "village" — or "" where it names none. */
	tierLabel(value) {
		return this._localizeAt(this.tierKeys, value);
	}

	/** Size's population band ("150–350 people"); "" for every rating that has none. */
	band(value) {
		return this._localizeAt(this.bandKeys, value);
	}

	/** One option per stored value, for the control that picks a named rating. */
	selectOptions(current) {
		return this.values.map(value => ({
			value,
			label:    this.tierLabel(value),
			band:     this.band(value),
			selected: value === current,
		}));
	}

	/** Every key this definition names — what the i18n coverage test walks. */
	get i18nKeys() {
		return [this.titleKey, this.shortTitleKey, ...(this.tierKeys ?? []), ...(this.bandKeys ?? [])].filter(Boolean);
	}

	_localizeAt(keys, value) {
		const index = this.indexOf(value);
		if (!keys || index < 0) return "";
		return game.i18n.localize(keys[index]);
	}
}
