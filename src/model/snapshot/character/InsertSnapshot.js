export class InsertSnapshot {
	constructor(b) {
		this.id               = b._id;
		this.slug             = b._slug;
		this.name             = b._name;
		this.img              = b._img;
		this.description      = b._description;
		this.instinctGroup    = b._instinctGroup;
		this.instinctSelected = b._instinctSelected;
		this.choices          = b._choices;
		this.moves            = b._moves;
	}
}

export class InsertSnapshotBuilder {
	withId(v)               { this._id               = v; return this; }
	withSlug(v)             { this._slug             = v; return this; }
	withName(v)             { this._name             = v; return this; }
	withImg(v)              { this._img              = v; return this; }
	withDescription(v)      { this._description      = v; return this; }
	withInstinctGroup(v)    { this._instinctGroup    = v; return this; }
	withInstinctSelected(v) { this._instinctSelected = v; return this; }
	withChoices(v)          { this._choices          = v; return this; }
	withMoves(v)            { this._moves            = v; return this; }
	build()                 { return new InsertSnapshot(this); }
}
