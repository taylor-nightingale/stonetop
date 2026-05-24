/**
 * Snapshot of a single owned follower card.
 *
 * @property {string}          slug
 * @property {string}          name
 * @property {string|null}     note
 * @property {number}          hp
 * @property {number}          hpMax
 * @property {number}          armor
 * @property {string|null}     damage
 * @property {Object|null}     instinct   — { type: "text"|"choices"|"custom", group? }
 * @property {string|null}     cost
 * @property {number}          loyalty
 * @property {number}          loyaltyMax
 * @property {ChoiceGroup|null} options   — pick-from-options rows, or null if none
 * @property {string}          instinctCustom
 */
export class FollowerSnapshot {
	constructor(b) {
		this.slug           = b._slug;
		this.name           = b._name;
		this.note           = b._note;
		this.hp             = b._hp;
		this.hpMax          = b._hpMax;
		this.armor          = b._armor;
		this.damage         = b._damage;
		this.instinct       = b._instinct;
		this.cost           = b._cost;
		this.loyalty        = b._loyalty;
		this.loyaltyMax     = b._loyaltyMax;
		this.options        = b._options;
		this.instinctCustom = b._instinctCustom;
	}
}

export class FollowerSnapshotBuilder {
	withSlug(v)           { this._slug           = v; return this; }
	withName(v)           { this._name           = v; return this; }
	withNote(v)           { this._note           = v; return this; }
	withHp(v)             { this._hp             = v; return this; }
	withHpMax(v)          { this._hpMax          = v; return this; }
	withArmor(v)          { this._armor          = v; return this; }
	withDamage(v)         { this._damage         = v; return this; }
	withInstinct(v)       { this._instinct       = v; return this; }
	withCost(v)           { this._cost           = v; return this; }
	withLoyalty(v)        { this._loyalty        = v; return this; }
	withLoyaltyMax(v)     { this._loyaltyMax     = v; return this; }
	withOptions(v)        { this._options        = v; return this; }
	withInstinctCustom(v) { this._instinctCustom = v; return this; }
	build()               { return new FollowerSnapshot(this); }
}
