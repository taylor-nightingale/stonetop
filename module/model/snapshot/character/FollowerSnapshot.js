/**
 * Snapshot of a single owned follower card.
 *
 * @property {string}           slug
 * @property {string}           name
 * @property {string|null}      note
 * @property {number}           hp
 * @property {number}           hpMax
 * @property {number}           armor
 * @property {string|null}      damage      — die string, e.g. "d6"
 * @property {number}           loyalty
 * @property {number}           loyaltyMax
 * @property {ChoiceGroup|null} choices     — unified weapon/instinct/cost/pick rows
 */
export class FollowerSnapshot {
	constructor(b) {
		this.slug       = b._slug;
		this.name       = b._name;
		this.note       = b._note;
		this.hp         = b._hp;
		this.hpMax      = b._hpMax;
		this.armor      = b._armor;
		this.damage     = b._damage;
		this.loyalty    = b._loyalty;
		this.loyaltyMax = b._loyaltyMax;
		this.choices    = b._choices;
	}
}

export class FollowerSnapshotBuilder {
	withSlug(v)       { this._slug       = v; return this; }
	withName(v)       { this._name       = v; return this; }
	withNote(v)       { this._note       = v; return this; }
	withHp(v)         { this._hp         = v; return this; }
	withHpMax(v)      { this._hpMax      = v; return this; }
	withArmor(v)      { this._armor      = v; return this; }
	withDamage(v)     { this._damage     = v; return this; }
	withLoyalty(v)    { this._loyalty    = v; return this; }
	withLoyaltyMax(v) { this._loyaltyMax = v; return this; }
	withChoices(v)    { this._choices    = v; return this; }
	build()           { return new FollowerSnapshot(this); }
}
