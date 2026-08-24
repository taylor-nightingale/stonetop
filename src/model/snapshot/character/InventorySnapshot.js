// ── Load ──────────────────────────────────────────────────────────────────────

/** One load level row (light / normal / heavy): the printed line, and whether the marks land in it. */
export class LoadOptionSnapshot {
	constructor(slug, note, active) {
		this.slug   = slug;
		this.note   = note;
		this.active = active;
	}
}

/**
 * @property {number} markedWeight
 * @property {number} capacity
 * @property {boolean} overCapacity
 * @property {LoadOptionSnapshot[]} options
 */
export class LoadSnapshot {
	constructor(b) {
		this.markedWeight    = b._markedWeight;
		this.capacity        = b._capacity;
		this.overCapacity    = b._overCapacity;
		this.options         = b._options;
	}
}

export class LoadSnapshotBuilder {
	withMarkedWeight(v)    { this._markedWeight    = v; return this; }
	withCapacity(v)        { this._capacity        = v; return this; }
	withOverCapacity(v)    { this._overCapacity    = v; return this; }
	withOptions(v)         { this._options          = v; return this; }
	build()                { return new LoadSnapshot(this); }
}

// ── Inventory item ────────────────────────────────────────────────────────────

/**
 * @property {string}      slug
 * @property {string}      name
 * @property {ResolvedTag[]} tags     — one entry per tag, each with its book definition when there is one
 * @property {string|null} note      — parenthetical annotation, e.g. "x piercing"
 * @property {number}      weight
 * @property {boolean}     checked
 * @property {Resource|null} resource
 * @property {boolean}     isCustom
 * @property {string|null} ownedId
 * @property {boolean}     twoCol
 */
export class OutfitItemSnapshot {
	constructor(b) {
		this.slug     = b._slug;
		this.name     = b._name;
		this.tags     = b._tags;
		this.note     = b._note;
		this.weight   = b._weight;
		this.checked  = b._checked;
		this.resource = b._resource;
		this.isCustom = b._isCustom;
		this.ownedId  = b._ownedId;
		this.twoCol   = b._twoCol;
	}
}

export class OutfitItemSnapshotBuilder {
	withSlug(v)     { this._slug     = v; return this; }
	withName(v)     { this._name     = v; return this; }
	withTags(v)     { this._tags     = v; return this; }
	withNote(v)     { this._note     = v; return this; }
	withWeight(v)   { this._weight   = v; return this; }
	withChecked(v)  { this._checked  = v; return this; }
	withResource(v) { this._resource = v; return this; }
	withIsCustom(v) { this._isCustom = v; return this; }
	withOwnedId(v)  { this._ownedId  = v; return this; }
	withTwoCol(v)   { this._twoCol   = v; return this; }
	build()         { return new OutfitItemSnapshot(this); }
}

/** A named group of outfit items within a column (maps to a compendium folder). */
export class OutfitSection {
	constructor(name, items) {
		this.name  = name;
		this.items = items;
	}
}

// ── Outfit ────────────────────────────────────────────────────────────────────

/**
 * One rung of the Prosperity gear table printed on the inventory insert.
 * @property {string} label - the rating as printed, e.g. "+1"
 * @property {string} note - what gear is like at that rating (may be empty, and may carry markup)
 * @property {boolean} current - this is the rung the character's steading is at
 */
export class ProsperityRowSnapshot {
	constructor(value, note, current) {
		this.label   = value >= 0 ? `+${value}` : `${value}`;
		this.note    = note;
		this.current = current;
	}
}

/**
 * The steading's Prosperity, shown on the inventory tab because Outfit
 * availability and the small-items pool ("mark □ equal to 4+Prosperity")
 * depend on it.
 * @property {string} steadingName - e.g. "Stonetop"
 * @property {number} value - the Prosperity roll bonus, e.g. 0, already adjusted for `lacking`
 * @property {boolean} lacking - the steading has the lacking debility; `value` is already 1 lower
 * @property {ProsperityRowSnapshot[]} rows - the gear table, one row marked current
 */
export class ProsperitySnapshot {
	constructor(steadingName, value, lacking, rows) {
		this.steadingName = steadingName;
		this.value        = value;
		this.lacking      = lacking;
		this.rows         = rows;
	}
}

/**
 * @property {LoadSnapshot} load
 * @property {OutfitSection[]} regularSections
 * @property {Resource} regularPool
 * @property {OutfitSection[]} smallSections
 * @property {Resource} smallPool
 * @property {ProsperitySnapshot|null} prosperity - null when the world has no steading
 */
export class OutfitSnapshot {
	constructor(b) {
		this.load             = b._load;
		this.regularSections  = b._regularSections;
		this.regularPool      = b._regularPool;
		this.smallSections    = b._smallSections;
		this.smallPool        = b._smallPool;
		this.otherItems       = b._otherItems ?? "";
		this.prosperity       = b._prosperity ?? null;
	}
}

export class OutfitSnapshotBuilder {
	withLoad(v)            { this._load            = v; return this; }
	withRegularSections(v) { this._regularSections = v; return this; }
	withRegularPool(v)     { this._regularPool     = v; return this; }
	withSmallSections(v)   { this._smallSections   = v; return this; }
	withSmallPool(v)       { this._smallPool       = v; return this; }
	withOtherItems(v)      { this._otherItems      = v; return this; }
	withProsperity(v)      { this._prosperity      = v; return this; }
	build()                { return new OutfitSnapshot(this); }
}

// ── Possessions ───────────────────────────────────────────────────────────────

/**
 * @property {number} pickCount
 * @property {string} pickNote
 * @property {PossessionItemSnapshot[]} items
 */
export class PossessionsSnapshot {
	constructor(pickCount, pickNote, items) {
		this.pickCount = pickCount;
		this.pickNote  = pickNote;
		this.items     = items;
	}
}

/**
 * @property {string} slug
 * @property {string} label
 * @property {string} description
 * @property {boolean} selected
 * @property {boolean} checked
 * @property {boolean} disabled
 * @property {boolean} preselected
 * @property {string|null} preselectedSource
 * @property {Resource|null} resource
 * @property {string|null} usesLabel
 * @property {ChoiceGroup|null} choices
 * @property {boolean} removable
 */
export class PossessionItemSnapshot {
	constructor(b) {
		this.slug              = b._slug;
		this.label             = b._label;
		this.description       = b._description;
		this.selected          = b._selected;
		this.checked           = b._checked;
		this.disabled          = b._disabled;
		this.preselected       = b._preselected;
		this.preselectedSource = b._preselectedSource;
		this.resource          = b._resource;
		this.usesLabel         = b._usesLabel;
		this.choices           = b._choices;
		this.removable         = b._removable ?? false;
	}
}

export class PossessionItemSnapshotBuilder {
	withSlug(v)              { this._slug              = v; return this; }
	withLabel(v)             { this._label             = v; return this; }
	withDescription(v)       { this._description       = v; return this; }
	withSelected(v)          { this._selected          = v; return this; }
	withChecked(v)           { this._checked           = v; return this; }
	withDisabled(v)          { this._disabled          = v; return this; }
	withPreselected(v)       { this._preselected       = v; return this; }
	withPreselectedSource(v) { this._preselectedSource = v; return this; }
	withResource(v)          { this._resource          = v; return this; }
	withUsesLabel(v)         { this._usesLabel         = v; return this; }
	withChoices(v)           { this._choices           = v; return this; }
	withRemovable(v)         { this._removable         = v; return this; }
	build()                  { return new PossessionItemSnapshot(this); }
}

// ── Inventory ─────────────────────────────────────────────────────────────────

/**
 * @property {OutfitSnapshot} outfit
 * @property {PossessionsSnapshot|null} possessions
 * @property {string} otherItems
 */
export class InventorySnapshot {
	constructor(outfit, possessions, otherItems) {
		this.outfit      = outfit;
		this.possessions = possessions;
		this.otherItems = otherItems;
	}
}
