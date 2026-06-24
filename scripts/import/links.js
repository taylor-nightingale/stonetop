/**
 * Cross-reference remapper. The fork links documents with Foundry UUIDs like
 *   @UUID[Compendium.stonetop_pwd.stonetop-journal.JournalEntry.5Sv77XzHPMBgZqJZ]{Great Wood}
 * and bare refs (monster `entry`, writeup `statBlocks`) of the same Compendium.* form. The
 * fork crams every journal into one pack (`stonetop-journal`); we split them across three
 * packs, so the only stable key is the document `_id` (the final segment). We register each
 * source record's old `_id` → our new UUID, then rewrite references by that id alone —
 * regardless of the scope/pack/type the old reference named.
 */
export class LinkMap {
	#byOldId = new Map();

	/** Map a source document's old `_id` to our new full UUID (Compendium.stonetop.<pack>.<Type>.<newId>). */
	register(oldId, newUuid) {
		if (!oldId) return;
		this.#byOldId.set(oldId, newUuid);
	}

	/** New UUID for an old id, or undefined if we never imported it. */
	resolve(oldId) {
		return this.#byOldId.get(oldId);
	}

	/**
	 * Rewrite every `Compendium.<scope>.<pack>.<Type>.<id>` token whose id we know to our new
	 * UUID. Unknown ids are left untouched (so dangling refs are visible, not silently mangled).
	 * Works inside `@UUID[…]{label}` and on bare refs alike.
	 */
	relink(text) {
		if (!text) return text;
		return String(text).replace(
			/Compendium\.[\w-]+\.[\w-]+\.(?:Actor|JournalEntry|Item)\.([A-Za-z0-9]{16})/g,
			(whole, oldId) => this.#byOldId.get(oldId) ?? whole,
		);
	}

	/** A bare ref (entry/statBlock) → new UUID, or "" if unknown. */
	relinkRef(ref) {
		if (!ref) return "";
		const m = String(ref).match(/\.([A-Za-z0-9]{16})$/);
		const mapped = m && this.#byOldId.get(m[1]);
		return mapped ?? "";
	}
}

/** Build the full UUID for one of our pack documents. Our system id (scope) is "stonetop". */
export function ourUuid(pack, documentType, id) {
	return `Compendium.stonetop.${pack}.${documentType}.${id}`;
}
