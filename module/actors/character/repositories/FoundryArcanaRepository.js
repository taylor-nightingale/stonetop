import { MinorArcanum } from "../../../model/MinorArcanum.js";
import { FoundryPackStore } from "./FoundryPackStore.js";
import { ITEM_FLAG_SCOPE } from "../StonetopFlags.js";

export class FoundryArcanaRepository {
	constructor() {
		this._store = new FoundryPackStore("stonetop.stonetop-items", [`flags.${ITEM_FLAG_SCOPE}.slug`]);
		this._cache = new Map();
	}

	async findBySlug(slug) {
		if (this._cache.has(slug)) return this._cache.get(slug);
		// Shipped pack arcana are immutable at runtime → safe to cache.
		const entry = await this._store.findEntry(e => e.flags?.[ITEM_FLAG_SCOPE]?.slug === slug);
		if (entry) {
			const doc     = await this._store.getDocument(entry._id);
			const arcanum = new MinorArcanum(doc.flags[ITEM_FLAG_SCOPE]);
			this._cache.set(slug, arcanum);
			return arcanum;
		}
		// World-authored custom arcanum (a `move`/arcanum item carrying the slug flag), created
		// via the character sheet's "Create Custom Arcanum" flow. NOT cached — it's user-editable,
		// so re-read each render and the edits show without any cache-invalidation plumbing.
		const payload = this._findWorldArcanumFlags(slug);
		return payload ? new MinorArcanum(payload) : null;
	}

	/** The `flags.stonetop` payload of a world `move`/arcanum item with this slug, or null. */
	_findWorldArcanumFlags(slug) {
		const items = globalThis.game?.items;
		if (!items?.find) return null;
		const doc = items.find(i =>
			i?.type === "move" &&
			i?.system?.moveType === "arcanum" &&
			i?.flags?.[ITEM_FLAG_SCOPE]?.slug === slug);
		return doc ? doc.flags[ITEM_FLAG_SCOPE] : null;
	}

	async findBySlugs(slugs) {
		return (await Promise.all(slugs.map(s => this.findBySlug(s)))).filter(Boolean);
	}
}
