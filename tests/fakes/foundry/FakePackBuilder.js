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

function indexRow(item, fields) {
	const row = {};
	for (const key of [...CORE_FIELDS, ...SCAFFOLDING]) {
		if (item[key] !== undefined) row[key] = item[key];
	}
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
		return {
			// Until getIndex runs, an index row is core fields only — the same state a caller that
			// never indexed would find in Foundry.
			index: items.map(item => indexRow(item, [])),
			folders: [],
			async getIndex({ fields = [] } = {}) {
				this.index = items.map(item => indexRow(item, fields));
				return this.index;
			},
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
