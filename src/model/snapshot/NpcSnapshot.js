export class NpcSnapshot {
	constructor(b) {
		this.hp               = b._hp;
		this.hpMax            = b._hpMax;
		this.armor            = b._armor;
		this.damage           = b._damage;
		this.tags             = b._tags             ?? "";
		this.specialQualities = b._specialQualities ?? "";
		this.instinct         = b._instinct         ?? "";
		this.moves            = b._moves            ?? [];
		this.description      = b._description      ?? "";
		this.cost             = b._cost             ?? "";
		this.loyalty          = b._loyalty          ?? 0;
		this.isFollower       = b._isFollower       ?? false;
		this.specialQuality   = b._specialQualities ?? "";
	}
}

export class NpcSnapshotBuilder {
	withHp(v)               { this._hp               = v; return this; }
	withHpMax(v)            { this._hpMax            = v; return this; }
	withArmor(v)            { this._armor            = v; return this; }
	withDamage(v)           { this._damage           = v; return this; }
	withTags(v)             { this._tags             = v; return this; }
	withSpecialQualities(v) { this._specialQualities = v; return this; }
	withInstinct(v)         { this._instinct         = v; return this; }
	withMoves(v)            { this._moves            = v; return this; }
	withDescription(v)      { this._description      = v; return this; }
	withCost(v)             { this._cost             = v; return this; }
	withLoyalty(v)          { this._loyalty          = v; return this; }
	withIsFollower(v)       { this._isFollower       = v; return this; }
	build()                 { return new NpcSnapshot(this); }
}
