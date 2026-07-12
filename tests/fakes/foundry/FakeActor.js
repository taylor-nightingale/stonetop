import {FakeFlags} from "./FakeFlags.js";
import {migrateCreatureData} from "../../../src/data/creature.js";

export class FakeActor {
	_createdDocs = [];
	_updatedDocs = [];
	_updateOps = [];
	_deletedIds = [];
	_nextId = 0;

	constructor(builder) {
		this.system = builder.buildSystem();

		// The actor's DataModel schema (when the builder supplies one). Foundry validates every
		// `actor.update` against it and silently DROPS writes to keys the schema doesn't define — so the
		// fake must too, or a write to a mistyped/undefined `system.*` path looks like it persisted here
		// but vanishes in the real game (the bug this guards: `system.moveResources.texts`).
		this._systemSchema = builder.dataModel?.defineSchema?.() ?? null;

		this.name = builder._name;
		this.type = builder._type ?? "character";

		this.items = builder.buildItems();
		this._fakeFlags = builder.buildFlags();
		this.flags = this._fakeFlags.toRaw();

		// Optional: let a builder wire the typed-actor wrapper without the caller mutating the actor
		// after build() (see [[no-direct-mutation-after-builder]]).
		if (builder._typedActorFactory) this.typedActor = builder._typedActorFactory(this);
	}

	get createdDocs()  { return this._createdDocs; }
	get updatedDocs()  { return this._updatedDocs; }
	get updateOps()    { return this._updateOps; }
	get deletedIds()   { return this._deletedIds; }

	async createEmbeddedDocuments(_, docs) {
		const results = docs.map(d => ({ ...d, _id: `created-${this._nextId++}` }));
		this._createdDocs.push(...results);
		this.items.push(...results);
		return results;
	}

	async updateEmbeddedDocuments(_, updates, operation = {}) {
		this._updatedDocs.push(...updates);
		this._updateOps.push(...updates.map(() => operation));
		for (const update of updates) {
			const item = this.items.get(update._id);
			if (!item) continue;
			if (update.name !== undefined) item.name = update.name;
			if (update.system) {
				// Faithful to Foundry: it re-runs the data model's migrateData on the partial
				// {changed-keys} diff before merging it. A migration that default-injects an absent
				// field would clobber the stored value here — exactly the bug this guards against.
				const diff = (item.type === "follower" || item.type === "npc")
					? migrateCreatureData(JSON.parse(JSON.stringify(update.system)))
					: update.system;
				for (const [key, value] of Object.entries(diff)) {
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
			// Mirror Foundry: a `system.*` write to a path the schema doesn't define is stripped.
			if (this._systemSchema && path.startsWith("system.")
				&& !_systemPathAllowed(this._systemSchema, path.slice("system.".length).split("."))) continue;
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

// Walk a DataModel schema by an update path's parts: true if the path targets a defined field. A
// SchemaField (`_schema`) is descended into; an ObjectField / other leaf is a free-form bag, so any
// deeper path under it is allowed. An unknown key at any level → false (Foundry strips the write).
function _systemPathAllowed(schema, parts) {
	const [head, ...rest] = parts;
	const field = schema?.[head];
	if (!field) return false;
	if (rest.length === 0) return true;
	return field._schema ? _systemPathAllowed(field._schema, rest) : true;
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
