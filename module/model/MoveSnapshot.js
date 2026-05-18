/** Move or possession requirement. */
export class RequirementSnapshot {
	constructor(label, met) {
		this.label = label;
		this.met   = met;
	}
}

/**
 * @property {string} id          - compendium document ID
 * @property {string} compendiumId
 * @property {string|null} ownedId
 * @property {string} name
 * @property {string} description
 * @property {string|null} rollType - stat key | "ask" | "prompt" | null
 * @property {boolean} isStarting
 * @property {{ type: string, slug?: string }} source
 * @property {string|null} sourceLabel
 * @property {boolean} owned
 * @property {string[]} ownedIds
 * @property {boolean} locked
 * @property {RequirementSnapshot|null} requirement
 * @property {string|null} requiresLabel
 * @property {Resource|null} resource
 * @property {{ max: number, current: number }|null} repeat
 * @property {boolean} repeatable
 */
export class MoveSnapshot {
	constructor(b) {
		this.id            = b._id;
		this.compendiumId  = b._compendiumId;
		this.ownedId       = b._ownedId;
		this.name          = b._name;
		this.description   = b._description;
		this.rollType      = b._rollType;
		this.isStarting    = b._isStarting;
		this.source        = b._source;
		this.sourceLabel   = b._sourceLabel;
		this.owned         = b._owned;
		this.ownedIds      = b._ownedIds;
		this.locked        = b._locked;
		this.requirement   = b._requirement;
		this.requiresLabel = b._requiresLabel;
		this.resource      = b._resource;
		this.repeat        = b._repeat;
		this.repeatable    = b._repeatable;
	}
}

export class MoveSnapshotBuilder {
	withId(v)            { this._id            = v; return this; }
	withCompendiumId(v)  { this._compendiumId  = v; return this; }
	withOwnedId(v)       { this._ownedId       = v; return this; }
	withName(v)          { this._name          = v; return this; }
	withDescription(v)   { this._description   = v; return this; }
	withRollType(v)      { this._rollType      = v; return this; }
	withIsStarting(v)    { this._isStarting    = v; return this; }
	withSource(v)        { this._source        = v; return this; }
	withSourceLabel(v)   { this._sourceLabel   = v; return this; }
	withOwned(v)         { this._owned         = v; return this; }
	withOwnedIds(v)      { this._ownedIds      = v; return this; }
	withLocked(v)        { this._locked        = v; return this; }
	withRequirement(v)   { this._requirement   = v; return this; }
	withRequiresLabel(v) { this._requiresLabel = v; return this; }
	withResource(v)      { this._resource      = v; return this; }
	withRepeat(v)        { this._repeat        = v; return this; }
	withRepeatable(v)    { this._repeatable    = v; return this; }
	build()              { return new MoveSnapshot(this); }
}

/**
 * @property {string} key   - "playbook" | "basic" | "background" | "special" | ...
 * @property {string} title - e.g. "The Heavy Moves", "Basic Moves"
 * @property {string|null} note
 * @property {MoveSnapshot[]} moves
 */
export class MoveCategorySnapshot {
	constructor(b) {
		this.key   = b._key;
		this.title = b._title;
		this.note  = b._note;
		this.moves = b._moves;
	}
}

export class MoveCategorySnapshotBuilder {
	withKey(v)   { this._key   = v; return this; }
	withTitle(v) { this._title = v; return this; }
	withNote(v)  { this._note  = v; return this; }
	withMoves(v) { this._moves = v; return this; }
	build()      { return new MoveCategorySnapshot(this); }
}

/** One entry in Movelist.otherGroups. */
export class MoveGroupSnapshot {
	constructor(key, label, moves) {
		this.key   = key;
		this.label = label;
		this.moves = moves;
	}
}
