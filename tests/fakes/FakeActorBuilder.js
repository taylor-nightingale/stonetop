import {FakeFlags} from "./foundry/FakeFlags.js";
import {FakeActor} from "./foundry/FakeActor.js";
import {StonetopFakeFlagsBuilder} from "./StonetopFakeFlagsBuilder.js";

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

export class FakeActorBuilder {
	_flagsBuilder = new StonetopFakeFlagsBuilder();
	_rollMode = null;
	_playbookSlug = null;
	_name = "Brakken";
	_items = [];
	_level = 1;
	_armor = 0;
	_damage = null;
	_xp = {value: 0, max: 8};
	_hp = {value: 8, max: 8};
	_statBuilder = new FakeStatBuilder();
	_debilities = {
		weakened: {value: false},
		dazed: {value: false},
		miserable: {value: false},
	};

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

	withName(name) {
		this._name = name;
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

	withItems(items) {
		this._items = items;
		return this;
	}

	withRollMode(rollMode) {
		this._rollMode = rollMode;
		return this;
	}

	addItem(item) {
		this._items.push(item);
		return this;
	}

	withDebility(name, active) {
		this._debilities = {
			...this._debilities,
			[name]: {...this._debilities[name], value: active},
		};
		return this;
	}

	build() {
		this.buildFlags();

		return new FakeActor(this);
	}

	buildFlags() {
		return this._flagsBuilder.withFlag("rollMode", this._rollMode)
			.build();
	}

	buildItems() {
		const items = this._items;
		items.get = (id) => items.find(i => i._id === id) ?? null;
		return items;
	}

	buildStats() {
		return this._statBuilder.build();
	}
}
