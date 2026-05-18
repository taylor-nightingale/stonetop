// ── Unlock section items ──────────────────────────────────────────────────────

export class ArcanaUnlockTextItem {
	constructor(content) {
		this.type    = "text";
		this.content = content;
	}
}

export class ArcanaUnlockOptionSnapshot {
	constructor(b) {
		this.type        = "option";
		this.slug        = b._slug;
		this.description = b._description;
		this.count       = b._count;
		this.max         = b._max;
		this.selected    = b._selected;
	}
}

export class ArcanaUnlockOptionSnapshotBuilder {
	withSlug(v)        { this._slug        = v; return this; }
	withDescription(v) { this._description = v; return this; }
	withCount(v)       { this._count       = v; return this; }
	withMax(v)         { this._max         = v; return this; }
	withSelected(v)    { this._selected    = v; return this; }
	build()            { return new ArcanaUnlockOptionSnapshot(this); }
}

export class ArcanumUnlockSection {
	constructor(description, requirements) {
		this.description  = description;
		this.requirements = requirements;
	}
}

// ── Back side ─────────────────────────────────────────────────────────────────

export class ArcanumBackMoveSnapshot {
	constructor(name, rollType, description) {
		this.name        = name;
		this.rollType    = rollType;
		this.description = description;
	}
}

export class ArcanaBackOptionSnapshot {
	constructor(b) {
		this.slug        = b._slug;
		this.description = b._description;
		this.count       = b._count;
		this.max         = b._max;
		this.selected    = b._selected;
	}
}

export class ArcanaBackOptionSnapshotBuilder {
	withSlug(v)        { this._slug        = v; return this; }
	withDescription(v) { this._description = v; return this; }
	withCount(v)       { this._count       = v; return this; }
	withMax(v)         { this._max         = v; return this; }
	withSelected(v)    { this._selected    = v; return this; }
	build()            { return new ArcanaBackOptionSnapshot(this); }
}

// ── Front / back snapshots ────────────────────────────────────────────────────

export class MinorArcanumFrontSnapshot {
	constructor(b) {
		this.title       = b._title;
		this.weight      = b._weight;
		this.note        = b._note;
		this.description = b._description;
		this.unlock      = b._unlock;
	}
}

export class MinorArcanumFrontSnapshotBuilder {
	withTitle(v)       { this._title       = v; return this; }
	withWeight(v)      { this._weight      = v; return this; }
	withNote(v)        { this._note        = v; return this; }
	withDescription(v) { this._description = v; return this; }
	withUnlock(v)      { this._unlock      = v; return this; }
	build()            { return new MinorArcanumFrontSnapshot(this); }
}

export class MinorArcanumBackSnapshot {
	constructor(b) {
		this.title       = b._title;
		this.weight      = b._weight;
		this.note        = b._note;
		this.description = b._description;
		this.resource    = b._resource;
		this.move        = b._move;
		this.options     = b._options;
	}
}

export class MinorArcanumBackSnapshotBuilder {
	withTitle(v)       { this._title       = v; return this; }
	withWeight(v)      { this._weight      = v; return this; }
	withNote(v)        { this._note        = v; return this; }
	withDescription(v) { this._description = v; return this; }
	withResource(v)    { this._resource    = v; return this; }
	withMove(v)        { this._move        = v; return this; }
	withOptions(v)     { this._options     = v; return this; }
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
	}
}

export class MinorArcanumSnapshotBuilder {
	withSlug(v)    { this._slug    = v; return this; }
	withFront(v)   { this._front   = v; return this; }
	withBack(v)    { this._back    = v; return this; }
	withOwned(v)   { this._owned   = v; return this; }
	withFlipped(v) { this._flipped = v; return this; }
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
