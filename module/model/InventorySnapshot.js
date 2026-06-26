import { LOAD_LEVEL_LIMITS } from "../utils/load.js";

// ── Load ──────────────────────────────────────────────────────────────────────

/**
 * Load is a derived readout — the count of ◇ actually marked (checked item
 * weights plus the undefined regular pool), bucketed into a load level. The
 * player never picks it directly; marking items or editing the pool re-derives it.
 *
 * @property {string} instruction
 * @property {string|null} selected
 * @property {boolean} loadLevelLight
 * @property {boolean} loadLevelNormal
 * @property {boolean} loadLevelHeavy
 * @property {boolean} loadLevelOverloaded - 10+ ◇ (heavy and then some): risk exhaustion/injury
 * @property {number} totalMarks           - Total ◇ marked (checked weights + undefined pool)
 */
export class LoadSnapshot {
	constructor(b) {
		this.instruction        = b._instruction;
		this.selected           = b._selected;
		this.loadLevelLight     = b._loadLevelLight;
		this.loadLevelNormal    = b._loadLevelNormal;
		this.loadLevelHeavy     = b._loadLevelHeavy;
		this.loadLevelOverloaded = b._loadLevelOverloaded ?? false;
		this.totalMarks         = b._totalMarks ?? 0;
	}
}

export class LoadSnapshotBuilder {
	withInstruction(v)        { this._instruction        = v; return this; }
	withSelected(v)           { this._selected           = v; return this; }
	withLoadLevelLight(v)     { this._loadLevelLight     = v; return this; }
	withLoadLevelNormal(v)    { this._loadLevelNormal    = v; return this; }
	withLoadLevelHeavy(v)     { this._loadLevelHeavy     = v; return this; }
	withLoadLevelOverloaded(v){ this._loadLevelOverloaded = v; return this; }
	withTotalMarks(v)         { this._totalMarks         = v; return this; }
	build()                   { return new LoadSnapshot(this); }
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
		this.disabled    = b._disabled ?? false;
		this.resource    = b._resource;
		this.isCustom    = b._isCustom;
		this.ownedId     = b._ownedId;
		this.twoCol      = b._twoCol;
		this.breakBefore = b._breakBefore;
		this.isAddedSpecial = b._isAddedSpecial ?? false;
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
	withIsAddedSpecial(v) { this._isAddedSpecial = v; return this; }
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
 * @property {number|null} smallItemLimit - 4+Prosperity from the linked steading actor, or null if unavailable
 * @property {string|null} steadingName   - Name of the linked steading actor, or null if unavailable
 * @property {boolean} hasPackHorse       - Ranger owns the Pack Horse move (boosted load caps)
 * @property {{light:number, normal:number, heavy:number}} loadLimits - Per-load weight caps in effect
 */
export class OutfitSnapshot {
	constructor(b) {
		this.load            = b._load;
		this.regularItems    = b._regularItems;
		this.regularSegments = b._regularSegments;
		this.regularPool      = b._regularPool;
		// True reservable ceiling for the undefined pool (room left under the load cap
		// after marked items). The track itself (regularPool.max) always shows the full
		// load capacity, so this smaller cap is what drives the "at your limit" toast when
		// a player clicks an empty slot past the room they actually have.
		this.regularPoolCap   = b._regularPoolCap ?? 0;
		this.smallItems       = b._smallItems;
		this.smallGridItems   = b._smallGridItems;
		this.smallPool        = b._smallPool;
		this.smallPoolCap     = b._smallPoolCap ?? 0;
		this.arcanaItems     = b._arcanaItems ?? [];
		this.smallItemLimit  = b._smallItemLimit ?? null;
		this.steadingName    = b._steadingName ?? null;
		this.hasPackHorse    = b._hasPackHorse ?? false;
		this.loadLimits      = b._loadLimits ?? LOAD_LEVEL_LIMITS;
	}
}

export class OutfitSnapshotBuilder {
	withLoad(v)            { this._load            = v; return this; }
	withRegularItems(v)    { this._regularItems    = v; return this; }
	withRegularSegments(v) { this._regularSegments = v; return this; }
	withRegularPool(v)     { this._regularPool     = v; return this; }
	withRegularPoolCap(v)  { this._regularPoolCap  = v; return this; }
	withSmallItems(v)      { this._smallItems      = v; return this; }
	withSmallGridItems(v)  { this._smallGridItems  = v; return this; }
	withSmallPool(v)       { this._smallPool       = v; return this; }
	withSmallPoolCap(v)    { this._smallPoolCap    = v; return this; }
	withArcanaItems(v)     { this._arcanaItems     = v; return this; }
	withSmallItemLimit(v)  { this._smallItemLimit  = v; return this; }
	withSteadingName(v)    { this._steadingName    = v; return this; }
	withHasPackHorse(v)    { this._hasPackHorse    = v; return this; }
	withLoadLimits(v)      { this._loadLimits      = v; return this; }
	build()                { return new OutfitSnapshot(this); }
}

// ── Possessions ───────────────────────────────────────────────────────────────

/**
 * @property {number} pickCount
 * @property {string} pickNote
 * @property {PossessionItemSnapshot[]} items
 */
export class PossessionsSnapshot {
	constructor(pickCount, pickNote, items, isIncomplete = false) {
		this.pickCount    = pickCount;
		this.pickNote     = pickNote;
		this.items        = items;
		this.isIncomplete = isIncomplete;
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
 * @property {boolean} isCustom  Player-written "something else (discuss with GM)" possession,
 *                               removed via the × button rather than deselected from the list.
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
		this.isCustom          = b._isCustom ?? false;
		// A fully player-authored possession (name + description + optional resource), created via
		// the "Add Custom Possession" dialog — distinct from the onboarding label-only write-in
		// (isCustom but not authored). Drives the per-card Edit affordance.
		this.isAuthored        = b._isAuthored ?? false;
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
	withCustom(v)            { this._isCustom          = v; return this; }
	withAuthored(v)          { this._isAuthored        = v; return this; }
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
