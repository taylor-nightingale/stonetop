import { PackFolders } from "./PackFolders.js";

export class FoundryPackStore {
	constructor(packName, fields) {
		this._packName = packName;
		this._fields   = fields;
		this._indexing = null;
	}

	// Memoises the PROMISE, not a done flag: callers that batch their lookups arrive together, and a flag
	// set after the await would let every one of them fetch the index.
	async _ensureIndexed() {
		const pack = game.packs.get(this._packName);
		if (!pack) return null;
		this._indexing ??= pack.getIndex({ fields: this._fields });
		await this._indexing;
		return pack;
	}

	async findEntry(predicate) {
		const pack = await this._ensureIndexed();
		if (!pack) return null;
		return pack.index.find(predicate) ?? null;
	}

	async filterEntries(predicate) {
		const pack = await this._ensureIndexed();
		if (!pack) return [];
		return [...pack.index].filter(predicate);
	}

	async getAll() {
		const pack = await this._ensureIndexed();
		if (!pack) return [];
		return [...pack.index];
	}

	async getDocument(id) {
		const pack = game.packs.get(this._packName);
		if (!pack) return null;
		return pack.getDocument(id);
	}

	/** The pack's folder tree, which knows both a folder's name and what it is filed under. */
	async getFolders() {
		const pack = await this._ensureIndexed();
		return new PackFolders(pack ? [...pack.folders] : []);
	}
}
