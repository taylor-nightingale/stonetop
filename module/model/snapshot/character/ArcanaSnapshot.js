// ── Back side ─────────────────────────────────────────────────────────────────

export class ArcanumBackMoveSnapshot {
	constructor(name, rollType, description) {
		this.name        = name;
		this.rollType    = rollType;
		this.description = description;
	}
}

// ── Front / back snapshots ────────────────────────────────────────────────────

export class MinorArcanumFrontSnapshot {
	constructor(b) {
		this.title       = b._title;
		this.item        = b._item;
		this.description = b._description;
		this.unlock      = b._unlock;
	}
}

export class MinorArcanumFrontSnapshotBuilder {
	withTitle(v)       { this._title       = v; return this; }
	withItem(v)        { this._item        = v; return this; }
	withDescription(v) { this._description = v; return this; }
	withUnlock(v)      { this._unlock      = v; return this; }
	build()            { return new MinorArcanumFrontSnapshot(this); }
}

export class MinorArcanumBackSnapshot {
	constructor(b) {
		this.title       = b._title;
		this.item        = b._item;
		this.description = b._description;
		this.resource    = b._resource;
		this.move        = b._move;
	}
}

export class MinorArcanumBackSnapshotBuilder {
	withTitle(v)       { this._title       = v; return this; }
	withItem(v)        { this._item        = v; return this; }
	withDescription(v) { this._description = v; return this; }
	withResource(v)    { this._resource    = v; return this; }
	withMove(v)        { this._move        = v; return this; }
	build()            { return new MinorArcanumBackSnapshot(this); }
}

// ── Arcanum ───────────────────────────────────────────────────────────────────

export class MinorArcanumSnapshot {
	constructor(b) {
		this.slug    = b._slug;
		this.front   = b._front;
		this.back    = b._back;
		this.owned   = b._owned;
		this.flipped = b._flipped;
		this.checked = b._checked;
	}
}

export class MinorArcanumSnapshotBuilder {
	withSlug(v)    { this._slug    = v; return this; }
	withFront(v)   { this._front   = v; return this; }
	withBack(v)    { this._back    = v; return this; }
	withOwned(v)   { this._owned   = v; return this; }
	withFlipped(v) { this._flipped = v; return this; }
	withChecked(v) { this._checked = v; return this; }
	build()        { return new MinorArcanumSnapshot(this); }
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
