export class ArmorSnapshot {
	constructor(value, note) {
		this.value = value;
		this.note  = note;
	}
}

export class FollowerDamageSnapshot {
	constructor(value, label, tags) {
		this.value = value;
		this.label = label;
		this.tags  = tags;
	}
}

/**
 * Snapshot of a single owned follower card.
 *
 * @property {string}                   slug
 * @property {string}                   name
 * @property {string|null}              tags        — DW-style tags string
 * @property {number}                   hp
 * @property {number}                   hpMax
 * @property {ArmorSnapshot|null}       armor
 * @property {FollowerDamageSnapshot|null} damage
 * @property {string}                   instinct
 * @property {string}                   specialQuality
 * @property {ResourceSnapshot|null}    loyalty
 * @property {string}                   description
 * @property {ChoiceGroup|null}         choices
 */
export class FollowerSnapshot {
	constructor(b) {
		this.slug           = b._slug;
		this.name           = b._name;
		this.tags           = b._tags;
		this.hp             = b._hp;
		this.hpMax          = b._hpMax;
		this.armor          = b._armor;
		this.damage         = b._damage;
		this.instinct       = b._instinct;
		this.specialQuality = b._specialQuality;
		this.loyalty        = b._loyalty;
		this.description    = b._description;
		this.choices        = b._choices;
		this.arcanaSlug     = b._arcanaSlug ?? null;
	}
}

export class FollowerSnapshotBuilder {
	withSlug(v)            { this._slug            = v; return this; }
	withName(v)            { this._name            = v; return this; }
	withTags(v)            { this._tags            = v; return this; }
	withHp(v)              { this._hp              = v; return this; }
	withHpMax(v)           { this._hpMax           = v; return this; }
	withArmor(v)           { this._armor           = v; return this; }
	withDamage(v)          { this._damage          = v; return this; }
	withInstinct(v)        { this._instinct        = v; return this; }
	withSpecialQuality(v)  { this._specialQuality  = v; return this; }
	withLoyalty(v)         { this._loyalty         = v; return this; }
	withDescription(v)     { this._description     = v; return this; } 
	withChoices(v)         { this._choices         = v; return this; }
	withArcanaSlug(v)      { this._arcanaSlug      = v; return this; }
	build()                { return new FollowerSnapshot(this); }
}
