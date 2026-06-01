// ── Origin ────────────────────────────────────────────────────────────────────

/** One origin region option. */
export class OriginOptionSnapshot {
	constructor(region, names, selected) {
		this.region   = region;
		this.names    = names;
		this.selected = selected;
	}
}

/** The origin section on PlaybookSnapshot. */
export class OriginSection {
	constructor(selected, options) {
		this.selected = selected;
		this.options  = options;
	}
}

// ── Background ────────────────────────────────────────────────────────────────

/**
 * One background option on PlaybookSnapshot.background.
 * @property {string} slug
 * @property {string} label
 * @property {string} description
 * @property {boolean} selected
 * @property {string[]} moves - move slugs granted by this background
 * @property {ChoiceGroup|null} choices
 */
export class BackgroundOptionSnapshot {
	constructor(b) {
		this.slug        = b._slug;
		this.label       = b._label;
		this.description = b._description;
		this.selected    = b._selected;
		this.moves       = b._moves;
		this.choices     = b._choices;
		this.resource    = b._resource ?? null;
	}
}

export class BackgroundOptionSnapshotBuilder {
	withSlug(v)        { this._slug        = v; return this; }
	withLabel(v)       { this._label       = v; return this; }
	withDescription(v) { this._description = v; return this; }
	withSelected(v)    { this._selected    = v; return this; }
	withMoves(v)       { this._moves       = v; return this; }
	withChoices(v)     { this._choices     = v; return this; }
	withResource(v)    { this._resource    = v; return this; }
	build()            { return new BackgroundOptionSnapshot(this); }
}

/** The background section on PlaybookSnapshot. */
export class BackgroundSection {
	constructor(selected, options) {
		this.selected = selected;
		this.options  = options;
	}
}


// ── Playbook ──────────────────────────────────────────────────────────────────

/**
 * @property {string} slug
 * @property {string} name
 * @property {string|null} img
 * @property {string|null} description
 * @property {string|null} statsNote
 * @property {LoreSection} lore
 * @property {BackgroundSection} background
 * @property {InstinctSection} instinct
 * @property {Object[]} appearance
 * @property {OriginSection} origin
 */
export class PlaybookSnapshot {
	constructor(b) {
		this.slug        = b._slug;
		this.name        = b._name;
		this.img         = b._img;
		this.titleImg    = b._slug ? `systems/stonetop/assets/playbooks/${b._slug}-title.png` : null;
		this.description = b._description;
		this.statsNote   = b._statsNote;
		this.lore        = b._lore;
		this.background  = b._background;
		this.instinct    = b._instinct;
		this.appearance  = b._appearance;
		this.origin      = b._origin;
	}
}

export class PlaybookSnapshotBuilder {
	withSlug(v)        { this._slug        = v; return this; }
	withName(v)        { this._name        = v; return this; }
	withImg(v)         { this._img         = v; return this; }
	withDescription(v) { this._description = v; return this; }
	withStatsNote(v)   { this._statsNote   = v; return this; }
	withLore(v)        { this._lore        = v; return this; }
	withBackground(v)  { this._background  = v; return this; }
	withInstinct(v)    { this._instinct    = v; return this; }
	withAppearance(v)  { this._appearance  = v; return this; }
	withOrigin(v)      { this._origin      = v; return this; }
	build()            { return new PlaybookSnapshot(this); }
}
