/**
 * @property {string} id
 * @property {string} name
 * @property {string|null} description
 * @property {string|null} moveType
 * @property {string} ownedId - same as id; provided for template convenience
 */
export class OtherItemSnapshot {
	constructor(b) {
		this.id          = b._id;
		this.name        = b._name;
		this.description = b._description;
		this.moveType    = b._moveType;
		this.ownedId     = b._ownedId;
	}
}

export class OtherItemSnapshotBuilder {
	withId(v)          { this._id          = v; return this; }
	withName(v)        { this._name        = v; return this; }
	withDescription(v) { this._description = v; return this; }
	withMoveType(v)    { this._moveType    = v; return this; }
	withOwnedId(v)     { this._ownedId     = v; return this; }
	build()            { return new OtherItemSnapshot(this); }
}

/**
 * @property {MoveSnapshot[]} playbookMoves
 * @property {MoveSnapshot[]} basicMoves
 * @property {MoveGroupSnapshot[]} otherGroups
 * @property {OtherItemSnapshot[]} otherMoves
 * @property {string|null} startingMovesNote
 * @property {{label: string, moves: MoveSnapshot[]}|null} postDeathGroup
 */
export class Movelist {
	constructor(b) {
		this.playbookMoves     = b._playbookMoves;
		this.basicMoves        = b._basicMoves;
		this.otherGroups       = b._otherGroups;
		this.otherMoves        = b._otherMoves;
		this.startingMovesNote = b._startingMovesNote;
		this.postDeathGroup    = b._postDeathGroup ?? null;
	}
}

export class MovelistBuilder {
	withPlaybookMoves(v)     { this._playbookMoves     = v; return this; }
	withBasicMoves(v)        { this._basicMoves        = v; return this; }
	withOtherGroups(v)       { this._otherGroups       = v; return this; }
	withOtherMoves(v)        { this._otherMoves        = v; return this; }
	withStartingMovesNote(v) { this._startingMovesNote = v; return this; }
	withPostDeathGroup(v)    { this._postDeathGroup    = v; return this; }
	build()                  { return new Movelist(this); }
}
