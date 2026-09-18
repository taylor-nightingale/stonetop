// A compendium pack whose index behaves like Foundry's: an index row carries the core fields plus
// ONLY the `fields` the caller asked `getIndex` for. Handing back whole documents instead would hide
// the bug this models — a repository that forgets to request `system.slug` still reads one, and the
// omission only shows up in a real world.
const CORE_FIELDS = ["_id", "name", "img", "type"];

// Test scaffolding rather than document data: `_starting` is a marker the fake repositories read off
// an index row, and `toObject` is how a fake entry hands itself back as a document.
const SCAFFOLDING = ["_starting", "toObject"];

function getPath(obj, path) {
	return path.split(".").reduce((node, key) => (node == null ? undefined : node[key]), obj);
}

function setPath(obj, path, value) {
	const keys = path.split(".");
	const last = keys.pop();
	const target = keys.reduce((node, key) => (node[key] ??= {}), obj);
	target[last] = value;
}

// A pack DOCUMENT, for the stores that read prose (FoundryPackDocumentStore). Unlike an index row
// it carries everything the item has, because that is the whole reason a repository asks for one:
// Babele translates a document's `system` and never an index row's.
function packDocument(item, packName) {
	const { toObject, ...data } = item;
	return {
		...data,
		uuid: item.uuid ?? `Compendium.stonetop.${packName}.Item.${item._id}`,
		toObject: toObject ?? (() => data),
	};
}

function indexRow(item, fields, packName) {
	const row = {};
	for (const key of [...CORE_FIELDS, ...SCAFFOLDING]) {
		if (item[key] !== undefined) row[key] = item[key];
	}
	// Every real index row carries one (CompendiumCollection#indexDocument), and PackProvenance reads it.
	if (item._id !== undefined) row.uuid = item.uuid ?? `Compendium.stonetop.${packName}.Item.${item._id}`;
	for (const path of fields) {
		const value = getPath(item, path);
		if (value !== undefined) setPath(row, path, value);
	}
	return row;
}

export class FakePackBuilder {
	_items = [];
	name;

	constructor(name) {
		this.name = name;
	}

	withItem(item) {
		this._items.push(item);
		return this;
	}

	build() {
		const items = this._items;
		const name  = this.name;
		// Foundry MERGES each getIndex call into the rows already there (CompendiumCollection#getIndex),
		// so fields accumulate: a second store asking only for `system.slug` cannot take `system.rollStat`
		// away from the repository that asked for it first. The fake accumulates for the same reason —
		// while still giving a caller that asked for nothing nothing, which is the bug this models.
		const requested = new Set();
		return {
			// Until getIndex runs, an index row is core fields only — the same state a caller that
			// never indexed would find in Foundry.
			index: items.map(item => indexRow(item, [], name)),
			folders: [],
			async getIndex({ fields = [] } = {}) {
				for (const field of fields) requested.add(field);
				this.index = items.map(item => indexRow(item, [...requested], name));
				return this.index;
			},
			async getDocuments() { return items.map(item => packDocument(item, name)); },
			async getDocument(id) { return items.find(e => e._id === id) ?? null; },
		};
	}

	static movesPack() {
		return new FakePackBuilder("moves");
	}

	static playbooksPack() {
		return new FakePackBuilder("playbooks");
	}
}
