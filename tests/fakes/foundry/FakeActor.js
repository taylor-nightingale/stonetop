import {FakeFlags} from "./FakeFlags.js";

export class FakeActor {
	_createdDocs = [];
	_updatedDocs = [];
	_deletedIds = [];
	_nextId = 0;

	constructor(builder) {
		this.system = {
			playbookSlug: builder._playbookSlug ?? "",
			stats: builder.buildStats(),
			attributes: {
				level: builder._level,
				hp: builder._hp,
				armor: builder._armor,
				xp: builder._xp,
				damage: builder._damage ?? {die: null},
				debilities: {options: {...builder._debilities}},
			},
		};

		this.name = builder._name;
		this.type = "character";

		this.items = builder.buildItems();
		this._fakeFlags = builder.buildFlags();
		this.flags = this._fakeFlags.toRaw();

	}

	get createdDocs()  { return this._createdDocs; }
	get updatedDocs()  { return this._updatedDocs; }
	get deletedIds()   { return this._deletedIds; }

	async createEmbeddedDocuments(_, docs) {
		const results = docs.map(d => ({ ...d, _id: `created-${this._nextId++}` }));
		this._createdDocs.push(...results);
		this.items.push(...results);
		return results;
	}

	async updateEmbeddedDocuments(_, updates) {
		this._updatedDocs.push(...updates);
		for (const update of updates) {
			const item = this.items.get(update._id);
			if (!item) continue;
			if (update.name !== undefined) item.name = update.name;
			if (update.system) {
				for (const [key, value] of Object.entries(update.system)) {
					item.system[key] = value;
				}
			}
		}
		return updates;
	}

	async deleteEmbeddedDocuments(_, ids) {
		this._deletedIds.push(...ids);
		const idSet = new Set(ids);
		const remaining = this.items.filter(i => !idSet.has(i._id));
		remaining.get = id => remaining.find(i => i._id === id) ?? null;
		this.items = remaining;
	}

	update(data) {
		for (const [path, value] of Object.entries(data)) {
			this._applyDotPath(this, path, value);
		}
	}

	_applyDotPath(target, path, value) {
		const parts = path.split(".");
		let obj = target;
		for (let i = 0; i < parts.length - 1; i++) {
			if (obj[parts[i]] === undefined || obj[parts[i]] === null) {
				obj[parts[i]] = {};
			}
			obj = obj[parts[i]];
		}
		obj[parts[parts.length - 1]] = value;
	}

	getFlag(scope, key) {
		return this._fakeFlags.getFlag(scope, key);
	}

	setFlag(scope, key, value) {
		return this._fakeFlags.setFlag(scope, key, value);
	}
}

function _deepAssign(target, source) {
	for (const [key, value] of Object.entries(source)) {
		if (value && typeof value === "object" && !Array.isArray(value)
				&& Object.keys(value).length > 0
				&& target[key] && typeof target[key] === "object") {
			_deepAssign(target[key], value);
		} else {
			target[key] = value;
		}
	}
}
