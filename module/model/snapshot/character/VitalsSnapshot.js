/** Used for hp and xp tracks in VitalsSnapshot. */
export class ValueMax {
	constructor(value, max) {
		this.value = value;
		this.max   = max;
	}
}

/**
 * @property {ValueMax} hp  - max = playbook.hp; both 0 if no playbook
 * @property {string|null} damage - e.g. "d10"; null if no playbook
 * @property {number} armor
 * @property {number} level
 * @property {ValueMax} xp  - max = 6 + level * 2
 */
export class VitalsSnapshot {
	constructor(b) {
		this.hp     = b._hp;
		this.damage = b._damage;
		this.armor  = b._armor;
		this.level  = b._level;
		this.xp     = b._xp;
	}
}

export class VitalsSnapshotBuilder {
	withHp(v)     { this._hp     = v; return this; }
	withDamage(v) { this._damage = v; return this; }
	withArmor(v)  { this._armor  = v; return this; }
	withLevel(v)  { this._level  = v; return this; }
	withXp(v)     { this._xp     = v; return this; }
	build()       { return new VitalsSnapshot(this); }
}
