// ── Load ──────────────────────────────────────────────────────────────────────

/** One load level option (light / normal / heavy). */
export class LoadOptionSnapshot {
	constructor(slug, label, note) {
		this.slug  = slug;
		this.label = label;
		this.note  = note;
	}
}

/**
 * @property {string} instruction
 * @property {string|null} selected
 * @property {boolean} loadLevelLight
 * @property {boolean} loadLevelNormal
 * @property {boolean} loadLevelHeavy
 * @property {LoadOptionSnapshot[]} options
 */
export class LoadSnapshot {
	constructor(b) {
		this.instruction     = b._instruction;
		this.selected        = b._selected;
		this.loadLevelLight  = b._loadLevelLight;
		this.loadLevelNormal = b._loadLevelNormal;
		this.loadLevelHeavy  = b._loadLevelHeavy;
		this.options         = b._options;
	}
}

export class LoadSnapshotBuilder {
	withInstruction(v)     { this._instruction     = v; return this; }
	withSelected(v)        { this._selected        = v; return this; }
	withLoadLevelLight(v)  { this._loadLevelLight  = v; return this; }
	withLoadLevelNormal(v) { this._loadLevelNormal = v; return this; }
	withLoadLevelHeavy(v)  { this._loadLevelHeavy  = v; return this; }
	withOptions(v)         { this._options          = v; return this; }
	build()                { return new LoadSnapshot(this); }
}

// ── Inventory item ────────────────────────────────────────────────────────────

/**
 * @property {string} slug
 * @property {string} name
 * @property {string|null} note
 * @property {number} weight
 * @property {boolean} checked
 * @property {Resource|null} resource
 * @property {boolean} isCustom
 * @property {string|null} ownedId
 * @property {boolean} twoCol
 * @property {boolean} breakBefore
 */
export class InventoryItemSnapshot {
	constructor(b) {
		this.slug        = b._slug;
		this.name        = b._name;
		this.note        = b._note;
		this.weight      = b._weight;
		this.checked     = b._checked;
		this.resource    = b._resource;
		this.isCustom    = b._isCustom;
		this.ownedId     = b._ownedId;
		this.twoCol      = b._twoCol;
		this.breakBefore = b._breakBefore;
	}
}

export class InventoryItemSnapshotBuilder {
	withSlug(v)        { this._slug        = v; return this; }
	withName(v)        { this._name        = v; return this; }
	withNote(v)        { this._note        = v; return this; }
	withWeight(v)      { this._weight      = v; return this; }
	withChecked(v)     { this._checked     = v; return this; }
	withResource(v)    { this._resource    = v; return this; }
	withIsCustom(v)    { this._isCustom    = v; return this; }
	withOwnedId(v)     { this._ownedId     = v; return this; }
	withTwoCol(v)      { this._twoCol      = v; return this; }
	withBreakBefore(v) { this._breakBefore = v; return this; }
	build()            { return new InventoryItemSnapshot(this); }
}

/** One contiguous block of grid or list items in OutfitSnapshot.regularSegments. */
export class InventorySegmentSnapshot {
	constructor(isGrid, segmentBreak, items) {
		this.isGrid       = isGrid;
		this.segmentBreak = segmentBreak;
		this.items        = items;
	}
}

// ── Outfit ────────────────────────────────────────────────────────────────────

/**
 * @property {LoadSnapshot} load
 * @property {InventoryItemSnapshot[]} regularItems
 * @property {InventorySegmentSnapshot[]} regularSegments
 * @property {Resource} regularPool
 * @property {InventoryItemSnapshot[]} smallItems
 * @property {InventoryItemSnapshot[]} smallGridItems
 * @property {Resource} smallPool
 */
export class OutfitSnapshot {
	constructor(b) {
		this.load            = b._load;
		this.regularItems    = b._regularItems;
		this.regularSegments = b._regularSegments;
		this.regularPool     = b._regularPool;
		this.smallItems      = b._smallItems;
		this.smallGridItems  = b._smallGridItems;
		this.smallPool       = b._smallPool;
	}
}

export class OutfitSnapshotBuilder {
	withLoad(v)            { this._load            = v; return this; }
	withRegularItems(v)    { this._regularItems    = v; return this; }
	withRegularSegments(v) { this._regularSegments = v; return this; }
	withRegularPool(v)     { this._regularPool     = v; return this; }
	withSmallItems(v)      { this._smallItems      = v; return this; }
	withSmallGridItems(v)  { this._smallGridItems  = v; return this; }
	withSmallPool(v)       { this._smallPool       = v; return this; }
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
 * @property {Object|null} choices
 * @property {Object|null} choiceGroups
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
		this.choiceGroups      = b._choiceGroups;
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
	withChoiceGroups(v)      { this._choiceGroups      = v; return this; }
	build()                  { return new PossessionItemSnapshot(this); }
}

// ── Inventory ─────────────────────────────────────────────────────────────────

/**
 * @property {OutfitSnapshot} outfit
 * @property {PossessionsSnapshot|null} possessions
 * @property {OtherItemSnapshot[]} other
 */
export class InventorySnapshot {
	constructor(outfit, possessions, other) {
		this.outfit      = outfit;
		this.possessions = possessions;
		this.other       = other;
	}
}
