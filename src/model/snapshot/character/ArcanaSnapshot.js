// ── Front / back snapshots ────────────────────────────────────────────────────

export class ArcanumFrontSnapshot {
	constructor(b) {
		this.title       = b._title;
		this.item        = b._item;
		this.description = b._description;
		this.unlock      = b._unlock;
	}
}

export class ArcanumFrontSnapshotBuilder {
	withTitle(v)       { this._title       = v; return this; }
	withItem(v)        { this._item        = v; return this; }
	withDescription(v) { this._description = v; return this; }
	withUnlock(v)      { this._unlock      = v; return this; }
	build()            { return new ArcanumFrontSnapshot(this); }
}

export class ArcanumBackSnapshot {
	constructor(b) {
		this.title        = b._title;
		this.item         = b._item;
		this.description  = b._description;
		this.resource     = b._resource;
		this.choices      = b._choices      ?? null;
		this.moves        = b._moves        ?? [];
		this.consequences = b._consequences ?? null; // ChoiceGroup|null
		this.unlockAt     = b._unlockAt     ?? null;
	}
}

export class ArcanumBackSnapshotBuilder {
	withTitle(v)        { this._title        = v; return this; }
	withItem(v)         { this._item         = v; return this; }
	withDescription(v)  { this._description  = v; return this; }
	withResource(v)     { this._resource     = v; return this; }
	withChoices(v)      { this._choices      = v; return this; }
	withMoves(v)        { this._moves        = v; return this; }
	withConsequences(v) { this._consequences = v; return this; }
	withUnlockAt(v)     { this._unlockAt     = v; return this; }
	build()             { return new ArcanumBackSnapshot(this); }
}

// ── Arcanum ───────────────────────────────────────────────────────────────────

export class ArcanumSnapshot {
	constructor(b) {
		this.slug    = b._slug;
		this.major   = b._major   ?? false;
		this.name    = b._name    ?? null;
		this.img     = b._img     ?? null;
		this.front   = b._front;
		this.back    = b._back;
		this.owned   = b._owned;
		this.flipped = b._flipped;
		this.checked = b._checked;
	}
}

export class ArcanumSnapshotBuilder {
	withSlug(v)    { this._slug    = v; return this; }
	withMajor(v)   { this._major   = v; return this; }
	withName(v)    { this._name    = v; return this; }
	withImg(v)     { this._img     = v; return this; }
	withFront(v)   { this._front   = v; return this; }
	withBack(v)    { this._back    = v; return this; }
	withOwned(v)   { this._owned   = v; return this; }
	withFlipped(v) { this._flipped = v; return this; }
	withChecked(v) { this._checked = v; return this; }
	build()        { return new ArcanumSnapshot(this); }
}

// ── Sections ──────────────────────────────────────────────────────────────────

export class ArcanaSectionSnapshot {
	constructor(title, items) {
		this.title = title;
		this.items = items;
	}

	get hasOwned() { return this.items.some(i => i.owned); }
}

export class ArcanaSnapshot {
	constructor(minor, major) {
		this.minor = minor;
		this.major = major;
	}
}
