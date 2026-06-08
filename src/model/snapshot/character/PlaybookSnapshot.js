// ── Introductions ─────────────────────────────────────────────────────────────

/**
 * @property {string|null} step3
 * @property {ChoiceGroup|null} npcGroup - step 4 NPC questions
 * @property {ChoiceGroup|null} pcGroup  - step 6 PC questions
 */
export class IntroductionsSnapshot {
	constructor(step3, npcGroup, pcGroup) {
		this.step3    = step3;
		this.npcGroup = npcGroup;
		this.pcGroup  = pcGroup;
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
 * @property {ChoiceGroup[]} choices - all non-instinct choice groups
 * @property {ChoiceGroup|null} instinctGroup
 * @property {string|null} instinctSelected - computed display label for instinct
 * @property {ChoiceGroup|null} appearanceGroup
 * @property {ChoiceGroup[]} loreGroups - all choices that are not appearance
 * @property {BackgroundSection} background
 * @property {OriginSection} origin
 * @property {IntroductionsSnapshot|null} introductions
 */
export class PlaybookSnapshot {
	constructor(b) {
		this.slug             = b._slug;
		this.name             = b._name;
		this.img              = b._img;
		this.titleImg         = b._slug ? `systems/stonetop/assets/playbooks/${b._slug}-title.png` : null;
		this.description      = b._description;
		this.statsNote        = b._statsNote;
		this.choices          = b._choices          ?? [];
		this.instinctGroup    = b._instinctGroup    ?? null;
		this.instinctSelected = b._instinctSelected ?? null;
		this.appearanceGroup  = b._appearanceGroup  ?? null;
		this.loreGroups       = b._loreGroups       ?? [];
		this.background       = b._background;
		this.origin           = b._origin;
		this.introductions    = b._introductions ?? null;
	}
}

export class PlaybookSnapshotBuilder {
	withSlug(v)             { this._slug             = v; return this; }
	withName(v)             { this._name             = v; return this; }
	withImg(v)              { this._img              = v; return this; }
	withDescription(v)      { this._description      = v; return this; }
	withStatsNote(v)        { this._statsNote        = v; return this; }
	withChoices(v)          { this._choices          = v; return this; }
	withInstinctGroup(v)    { this._instinctGroup    = v; return this; }
	withInstinctSelected(v) { this._instinctSelected = v; return this; }
	withAppearanceGroup(v)  { this._appearanceGroup  = v; return this; }
	withLoreGroups(v)       { this._loreGroups       = v; return this; }
	withBackground(v)       { this._background       = v; return this; }
	withOrigin(v)           { this._origin           = v; return this; }
	withIntroductions(v)    { this._introductions    = v; return this; }
	build()                 { return new PlaybookSnapshot(this); }
}
