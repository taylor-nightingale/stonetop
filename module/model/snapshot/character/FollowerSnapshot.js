/**
 * Snapshot of a single owned follower card.
 *
 * @property {string}                   slug
 * @property {string}                   name
 * @property {string|null}              tags        — DW-style tags string
 * @property {number}                   hp
 * @property {number}                   hpMax
 * @property {{value:number,note:string}|null} armor
 * @property {{die:string,label:string,tags:string}|null} damage
 * @property {string}                   instinct
 * @property {ResourceSnapshot|null}    loyalty
 * @property {ChoiceGroup|null}         choices
 */
export class FollowerSnapshot {
	constructor(b) {
		this.slug       = b._slug;
		this.name       = b._name;
		this.tags       = b._tags;
		this.hp         = b._hp;
		this.hpMax      = b._hpMax;
		this.armor      = b._armor;
		this.damage     = b._damage;
		this.instinct   = b._instinct;
		this.loyalty    = b._loyalty;
		this.choices    = b._choices;
		this.arcanaSlug = b._arcanaSlug ?? null;
	}
}

export class FollowerSnapshotBuilder {
	withSlug(v)       { this._slug       = v; return this; }
	withName(v)       { this._name       = v; return this; }
	withTags(v)       { this._tags       = v; return this; }
	withHp(v)         { this._hp         = v; return this; }
	withHpMax(v)      { this._hpMax      = v; return this; }
	withArmor(v)      { this._armor      = v; return this; }
	withDamage(v)     { this._damage     = v; return this; }
	withInstinct(v)   { this._instinct   = v; return this; }
	withLoyalty(v)    { this._loyalty    = v; return this; }
	withChoices(v)    { this._choices    = v; return this; }
	withArcanaSlug(v) { this._arcanaSlug = v; return this; }
	build()           { return new FollowerSnapshot(this); }
}
