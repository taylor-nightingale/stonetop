/**
 * A compendium pack read as DOCUMENTS, in the shape FoundryPackStore returns index entries.
 *
 * Interchangeable with FoundryPackStore and WorldItemStore — same four methods, same plain-object
 * entries — so a repository picks whichever it needs without anything above it knowing.
 *
 * It exists because a pack INDEX is not translated below `name`. Babele translates `pack.index` once
 * at world load, while the index still holds nothing but name/type/_id/folder/img/sort/uuid, and
 * stamps every entry as translated. `getIndex({fields})` later merges the raw `system.*` fields into
 * those same entries, and the re-translation short-circuits on that stamp — so every `system` string
 * read from an index stays in English however complete the translation is. Documents go through
 * Babele's document translation instead, which does run the converter.
 *
 * So: the index is for identity (a slug, an id, a name), documents are for prose. A repository that
 * reads nothing but `system.slug` should stay on FoundryPackStore, which is cheaper.
 *
 * Loading is memoised on a cache shared by every store for the same pack, because the sheets build
 * repositories per render and a pack is immutable while the world runs — changing the language
 * reloads Foundry, which empties this along with everything else.
 */

/** packName → the in-flight or settled load. Shared, session-scoped; see clearPackDocumentCache. */
const PACK_DOCUMENT_CACHE = new Map();

/** Drop what has been loaded. For tests, and for a dev reloading a pack it has just rebuilt. */
export function clearPackDocumentCache() {
	PACK_DOCUMENT_CACHE.clear();
}

export class FoundryPackDocumentStore {
	constructor(packName, cache = PACK_DOCUMENT_CACHE) {
		this._packName = packName;
		this._cache    = cache;
	}

	// Memoises the PROMISE, not the result: callers that batch their lookups arrive together, and a
	// value stored only after the await would let every one of them load the pack again.
	async _entries() {
		if (!this._cache.has(this._packName)) {
			this._cache.set(this._packName, this._load());
		}
		return this._cache.get(this._packName);
	}

	async _load() {
		const pack = game.packs?.get(this._packName);
		if (!pack) return [];
		const documents = await pack.getDocuments();
		// `uuid` rides along because an index entry carries one and callers may read it; it is the one
		// thing a document's own data does not restate.
		return documents.map(doc => ({ ...doc.toObject(), uuid: doc.uuid }));
	}

	async findEntry(predicate) {
		return (await this._entries()).find(predicate) ?? null;
	}

	async filterEntries(predicate) {
		return (await this._entries()).filter(predicate);
	}

	async getAll() {
		return [...await this._entries()];
	}

	async getDocument(id) {
		const pack = game.packs?.get(this._packName);
		if (!pack) return null;
		return pack.getDocument(id);
	}
}
