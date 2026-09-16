import { FoundryPackStore } from "./character/repositories/FoundryPackStore.js";
import { PACK_BY_TYPE } from "../item/packsByType.js";

// Where an embedded item came from, in the one place Foundry itself looks: `_stats.compendiumSource`.
//
// Core stamps that uuid when a document is dragged onto a sheet or imported (Document.fromDropData,
// WorldCollection.fromCompendium). A GRANT goes through neither — it copies `doc.toObject()` straight
// onto the actor — so a playbook's moves, possessions and inserts arrive carrying no
// trace of the compendium entry they are copies of, while a hand-dragged copy of the same move
// carries one. Everything that reasons about "which compendium document is this?" then works on half
// a sheet: Babele's actor translation, and any tool that refreshes an item from its source.
//
// We resolve by SLUG rather than by the id the copy was taken with, because the slug is the identity
// the rest of the system already trusts — it survives a pack rebuild that reissues ids, which is
// exactly the drift Foundry's own answer (a uuid + CONFIG.compendium.uuidRedirects table) exists to
// paper over. A world item is not a compendium document and takes no stamp: `#claimFreeSlug` keeps
// world slugs distinct from pack ones, so a slug that resolves in a pack IS the pack's.
export class PackProvenance {
	constructor(storeFor = (packName) => new FoundryPackStore(packName, ["system.slug"])) {
		this._storeFor = storeFor;
		this._stores   = new Map();
		this._uuids    = new Map();
	}

	/** The uuid of the compendium document `type`/`slug` names, or null when no pack ships it. */
	async uuidFor(type, slug) {
		if (!type || !slug) return null;
		const key = `${type}:${slug}`;
		if (this._uuids.has(key)) return this._uuids.get(key);

		const packName = PACK_BY_TYPE[type];
		const store    = packName ? this._store(packName) : null;
		const entry    = store ? await store.findEntry(e => e.system?.slug === slug) : null;
		// A pack index row carries its own uuid (CompendiumCollection#indexDocument); composing one is
		// the fallback for an index that predates it.
		const uuid = entry ? entry.uuid ?? `Compendium.${packName}.Item.${entry._id}` : null;
		this._uuids.set(key, uuid);
		return uuid;
	}

	/**
	 * One item's embed payload, carrying the provenance Foundry's own tooling reads.
	 *
	 * An existing `compendiumSource` wins: core set it because this really was dragged from that
	 * document, and it may name a pack we know nothing about.
	 *
	 * Babele's flags go the other way and are dropped. They describe the COMPENDIUM document this is a
	 * copy of — `translated: true` and the payload of what Babele changed there — and they ride along
	 * in `toObject()`. Left on the copy they are a lie about the copy: Babele reads `hasTranslation`
	 * and skips the item as already done, whatever language its prose is actually in.
	 */
	async sourced(itemData) {
		if (!itemData || typeof itemData !== "object") return itemData;

		const data = { ...itemData };
		if (data.flags?.babele) {
			const { babele, ...rest } = data.flags;
			data.flags = rest;
		}

		if (data._stats?.compendiumSource) return data;
		const uuid = await this.uuidFor(data.type, data.system?.slug);
		if (!uuid) return data;
		return { ...data, _stats: { ...(data._stats ?? {}), compendiumSource: uuid } };
	}

	_store(packName) {
		if (!this._stores.has(packName)) this._stores.set(packName, this._storeFor(packName));
		return this._stores.get(packName);
	}
}
