export class FakeStatBuilder {
	_str = 0;
	_dex = 0;
	_con = 0;
	_wis = 0;
	_int = 0;
	_cha = 0;

	withStr(str) { this._str = str; return this; }
	withDex(dex) { this._dex = dex; return this; }
	withCon(con) { this._con = con; return this; }
	withInt(int) { this._int = int; return this; }
	withWis(wis) { this._wis = wis; return this; }
	withCha(cha) { this._cha = cha; return this; }

	build() {
		return {
			str: {value: this._str}, dex: {value: this._dex},
			con: {value: this._con}, int: {value: this._int},
			wis: {value: this._wis}, cha: {value: this._cha},
		};
	}
}

export class FakeActorBuilder {
	_flags        = {};
	_pbtaRollMode = null;
	_playbook     = {slug: null, name: null};
	_name         = "Brakken";
	_items        = [];
	_level        = 1;
	_armor        = 0;
	_xp           = {value: 0, max: 8};
	_hp           = {value: 8, max: 8};
	_statBuilder  = new FakeStatBuilder();
	_debilities   = {
		weakened:  {value: false, stat: ["str", "dex"]},
		dazed:     {value: false, stat: ["int", "wis"]},
		miserable: {value: false, stat: ["con", "cha"]},
	};

	withStats(statBuilder)    { this._statBuilder = statBuilder; return this; }
	withPlaybook(slug, name)  { this._playbook = {slug, name}; return this; }
	withName(name)            { this._name = name; return this; }
	withHp(current, max)      { this._hp = {value: current, max}; return this; }
	withXp(current, max)      { this._xp = {value: current, max}; return this; }
	withLevel(level)          { this._level = level; return this; }
	withArmor(armor)          { this._armor  = armor;  return this; }
	withItems(items)          { this._items = items; return this; }
	withRollMode(rollMode)    { this._pbtaRollMode = rollMode; return this; }

	addItem(item) {
		this._items.push(item);
		return this;
	}

	withFlag(key, value) {
		this._flags[key] = value;
		return this;
	}

	withFlags(flags) {
		Object.assign(this._flags, flags);
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
		const scopedFlags = {};
		for (const [key, value] of Object.entries(this._flags)) {
			_setProperty(scopedFlags, key, value);
		}
		if (this._pbtaRollMode !== null) scopedFlags.rollMode = this._pbtaRollMode;
		const flagStore = {stonetop: scopedFlags, stonetop: scopedFlags};

		return {
			name: this._name,
			type: "character",
			system: {
				playbook: this._playbook,
				stats: this._statBuilder.build(),
				attributes: {
					level:   {value: this._level},
					hp:      this._hp,
					armor:   {value: this._armor},
					xp:      this._xp,
					damage:  {value: "d4"},
					debilities: {options: {...this._debilities}},
				},
			},
			items: this._items,
			flags: flagStore,
			getFlag: (scope, key) => {
				const scoped = flagStore[scope];
				if (!scoped) return null;
				return _getProperty(scoped, key) ?? scoped[key] ?? null;
			},
			setFlag: vi.fn(async (scope, key, val) => {
				flagStore[scope] ??= {};
				_setProperty(flagStore[scope], key, val);
			}),
			unsetFlag: vi.fn(async (scope, key) => {
				_unsetProperty(flagStore[scope], key);
			}),
			update: vi.fn(),
			createEmbeddedDocuments: vi.fn(),
			deleteEmbeddedDocuments: vi.fn(),
		};
	}
}

function _getProperty(obj, path) {
	if (!obj || !path) return obj;
	if (Object.hasOwn(obj, path)) return obj[path];
	return String(path).split(".").reduce((value, key) => value?.[key], obj);
}

function _setProperty(obj, path, value) {
	const parts = String(path).split(".");
	let current = obj;
	for (const key of parts.slice(0, -1)) {
		current[key] ??= {};
		current = current[key];
	}
	current[parts.at(-1)] = value;
}

function _unsetProperty(obj, path) {
	if (!obj || !path) return;
	const parts = String(path).split(".");
	let current = obj;
	for (const key of parts.slice(0, -1)) {
		current = current?.[key];
		if (!current) return;
	}
	delete current[parts.at(-1)];
}
