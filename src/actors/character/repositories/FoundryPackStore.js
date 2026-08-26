import { PackFolders } from "./PackFolders.js";
import { TranslationCatalog } from "../../../i18n/TranslationCatalog.js";

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

	// Every index entry leaves here through the active language. A compendium index is not a document,
	// so it never sees prepareBaseData — without this, pickers built from the index (the playbook list,
	// among others) would stay English while the sheets they open are translated.
	_localized(entry) {
		return TranslationCatalog.current.localizedIndexEntry(entry);
	}

	async findEntry(predicate) {
		const pack = await this._ensureIndexed();
		if (!pack) return null;
		const entry = pack.index.find(predicate) ?? null;
		return entry ? this._localized(entry) : null;
	}

	async filterEntries(predicate) {
		const pack = await this._ensureIndexed();
		if (!pack) return [];
		return [...pack.index].filter(predicate).map(entry => this._localized(entry));
	}

	async getAll() {
		const pack = await this._ensureIndexed();
		if (!pack) return [];
		return [...pack.index].map(entry => this._localized(entry));
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
