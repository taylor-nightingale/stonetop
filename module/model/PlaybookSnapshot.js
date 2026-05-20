// ── Appearance ────────────────────────────────────────────────────────────────

/** One selectable option within an appearance line. */
export class AppearanceOptionSnapshot {
	constructor(value, selected) {
		this.value    = value;
		this.selected = selected;
	}
}

/** One line of appearance options (e.g. "tall and broad / lean and wiry / slight"). */
export class AppearanceLineSnapshot {
	constructor(lineIdx, options) {
		this.lineIdx = lineIdx;
		this.options = options;
	}
}

/** The full appearance section on PlaybookSnapshot. */
export class AppearanceSection {
	constructor(options) {
		this.options = options;
	}
}

// ── Instinct ──────────────────────────────────────────────────────────────────

/**
 * One instinct option.
 * @property {string} word
 * @property {string} description
 * @property {string} value  - composite "word — description" used as the saved value
 * @property {boolean} selected
 */
export class InstinctOptionSnapshot {
	constructor(b) {
		this.word        = b._word;
		this.description = b._description;
		this.value       = b._value;
		this.selected    = b._selected;
	}
}

export class InstinctOptionSnapshotBuilder {
	withWord(v)        { this._word        = v; return this; }
	withDescription(v) { this._description = v; return this; }
	withValue(v)       { this._value       = v; return this; }
	withSelected(v)    { this._selected    = v; return this; }
	build()            { return new InstinctOptionSnapshot(this); }
}

/** The instinct section on PlaybookSnapshot. */
export class InstinctSection {
	constructor(selected, options) {
		this.selected = selected;
		this.options  = options;
	}
}

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

/** One choice within a background's optional choice list. */
export class BackgroundChoiceOptionSnapshot {
	constructor(slug, label, checked) {
		this.slug    = slug;
		this.label   = label;
		this.checked = checked;
	}
}

/**
 * The choices sub-object on a BackgroundOptionSnapshot.
 * @property {string} label
 * @property {number[]} count
 * @property {string} countLabel
 * @property {BackgroundChoiceOptionSnapshot[]} options
 * @property {Object.<string,boolean>} saved
 */
export class BackgroundChoicesSnapshot {
	constructor(b) {
		this.label      = b._label;
		this.count      = b._count;
		this.countLabel = b._countLabel;
		this.options    = b._options;
		this.saved      = b._saved;
	}
}

export class BackgroundChoicesSnapshotBuilder {
	withLabel(v)      { this._label      = v; return this; }
	withCount(v)      { this._count      = v; return this; }
	withCountLabel(v) { this._countLabel = v; return this; }
	withOptions(v)    { this._options    = v; return this; }
	withSaved(v)      { this._saved      = v; return this; }
	build()           { return new BackgroundChoicesSnapshot(this); }
}

/**
 * One background option on PlaybookSnapshot.background.
 * @property {string} slug
 * @property {string} label
 * @property {string} description
 * @property {boolean} selected
 * @property {string[]} moves - move slugs granted by this background
 * @property {BackgroundChoicesSnapshot|null} choices
 */
export class BackgroundOptionSnapshot {
	constructor(b) {
		this.slug        = b._slug;
		this.label       = b._label;
		this.description = b._description;
		this.selected    = b._selected;
		this.moves       = b._moves;
		this.choices     = b._choices;
	}
}

export class BackgroundOptionSnapshotBuilder {
	withSlug(v)        { this._slug        = v; return this; }
	withLabel(v)       { this._label       = v; return this; }
	withDescription(v) { this._description = v; return this; }
	withSelected(v)    { this._selected    = v; return this; }
	withMoves(v)       { this._moves       = v; return this; }
	withChoices(v)     { this._choices     = v; return this; }
	build()            { return new BackgroundOptionSnapshot(this); }
}

/** The background section on PlaybookSnapshot. */
export class BackgroundSection {
	constructor(selected, options) {
		this.selected = selected;
		this.options  = options;
	}
}

// ── Lore ──────────────────────────────────────────────────────────────────────

export class LoreOptionSnapshot {
	constructor(b) {
		this.slug        = b._slug;
		this.description = b._description;
		this.type        = b._type ?? "checkbox";
		this.max         = this.type === "text" ? 0 : (b._max ?? 1);
		this.count       = this.type === "text" ? 0 : (b._count ?? 0);
		this.checks      = this.type === "text" ? [] : Array.from({ length: this.max }, (_, i) => i < this.count);
		this.textValue   = this.type === "text" ? (b._textValue ?? "") : null;
		this.requires    = b._requires ?? null;
	}
}

export class LoreOptionSnapshotBuilder {
	withSlug(v)        { this._slug        = v; return this; }
	withDescription(v) { this._description = v; return this; }
	withType(v)        { this._type        = v; return this; }
	withMax(v)         { this._max         = v; return this; }
	withCount(v)       { this._count       = v; return this; }
	withTextValue(v)   { this._textValue   = v; return this; }
	withRequires(v)    { this._requires    = v; return this; }
	build()            { return new LoreOptionSnapshot(this); }
}

export class LoreEntrySnapshot {
	constructor(b) {
		this.slug        = b._slug;
		this.title       = b._title;
		this.description = b._description;
		this.options     = b._options;
	}
}

export class LoreEntrySnapshotBuilder {
	withSlug(v)        { this._slug        = v; return this; }
	withTitle(v)       { this._title       = v; return this; }
	withDescription(v) { this._description = v; return this; }
	withOptions(v)     { this._options     = v; return this; }
	build()            { return new LoreEntrySnapshot(this); }
}

export class LoreSection {
	constructor(entries) {
		this.entries = entries;
	}

	get hasEntries() {
		return this.entries.length > 0;
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
 * @property {AppearanceSection} appearance
 * @property {OriginSection} origin
 */
export class PlaybookSnapshot {
	constructor(b) {
		this.slug        = b._slug;
		this.name        = b._name;
		this.img         = b._img;
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
