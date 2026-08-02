import {FakeActorScaffold} from "./FakeActorScaffold.js";
import {CharacterData} from "../../src/data/CharacterData.js";

export class FakeStatBuilder {
	_str = 0;
	_dex = 0;
	_con = 0;
	_wis = 0;
	_int = 0;
	_cha = 0;

	withStr(str) {
		this._str = str;
		return this;
	}

	withDex(dex) {
		this._dex = dex;
		return this;
	}

	withCon(con) {
		this._con = con;
		return this;
	}

	withInt(int) {
		this._int = int;
		return this;
	}

	withWis(wis) {
		this._wis = wis;
		return this;
	}

	withCha(cha) {
		this._cha = cha;
		return this;
	}

	build() {
		return {
			str: {value: this._str}, dex: {value: this._dex},
			con: {value: this._con}, int: {value: this._int},
			wis: {value: this._wis}, cha: {value: this._cha},
		};
	}
}

// Builds a fake `character`-type actor. Owns the character system shape (stats, debilities, xp,
// level, playbook); composes a FakeActorScaffold for the shared name/items/flags/handoff plumbing.
export class FakeCharacterActorBuilder {
	_scaffold = new FakeActorScaffold("Brakken");
	_rollMode = null;
	_playbookSlug = null;
	_level = 1;
	_armor = 0;
	_damage = null;
	_xp = {value: 0, max: 8};
	_hp = {value: 8, max: 8};
	_statBuilder = new FakeStatBuilder();
	_description = "";
	_notes = "";
	_debilities = {
		weakened: {value: false},
		dazed: {value: false},
		miserable: {value: false},
	};

	// Shared plumbing — delegated to the scaffold (no direct mutation after build()).
	withName(name)  { this._scaffold.setName(name); return this; }
	withItems(items) { this._scaffold.setItems(items); return this; }
	addItem(item)   { this._scaffold.addItem(item); return this; }
	withTypedActor(factory) { this._scaffold.setTypedActor(factory); return this; }
	withFlag(key, value) { this._scaffold.flagsBuilder.withFlag(key, value); return this; }
	withFlags(flags) { this._scaffold.flagsBuilder.withFlags(flags); return this; }

	withStats(statBuilder) {
		this._statBuilder = statBuilder;
		return this;
	}

	withPlaybook(slug) {
		this._playbookSlug = slug;
		return this;
	}

	withDamage(die) {
		this._damage = die ? {value: die} : null;
		return this;
	}

	withHp(current, max) {
		this._hp = {value: current, max};
		return this;
	}

	withXp(current, max) {
		this._xp = {value: current, max};
		return this;
	}

	withLevel(level) {
		this._level = level;
		return this;
	}

	withArmor(armor) {
		this._armor = armor;
		return this;
	}

	// The notes tab's two fields: bio (system.description) and session notes (system.notes).
	withDescription(text) {
		this._description = text;
		return this;
	}

	withNotes(text) {
		this._notes = text;
		return this;
	}

	withRollMode(rollMode) {
		this._rollMode = rollMode;
		return this;
	}

	withDebility(name, active) {
		this._debilities = {
			...this._debilities,
			[name]: {...this._debilities[name], value: active},
		};
		return this;
	}

	buildSystem() {
		return {
			playbookSlug: this._playbookSlug ?? "",
			description: this._description,
			notes: this._notes,
			stats: this._statBuilder.build(),
			attributes: {
				level: this._level,
				hp: this._hp,
				armor: this._armor,
				xp: this._xp,
				damage: this._damage ?? {die: null},
				debilities: {options: {...this._debilities}},
			},
		};
	}

	build() {
		this._scaffold.flagsBuilder.withFlag("rollMode", this._rollMode);
		return this._scaffold.build("character", this.buildSystem(), CharacterData);
	}
}
