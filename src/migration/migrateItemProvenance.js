import { PackProvenance } from "../actors/PackProvenance.js";
import { info } from "../utils/logger.js";

// Give the items already on an actor the provenance new ones now get — see PackProvenance.
//
// Two separate repairs, both of which decide whether a tool can tell what an embedded item is a copy
// of. Neither touches a single word of the item's own content.
//
//   _stats.compendiumSource   Resolved from the item's slug. Absent on everything a grant created,
//                             which is nearly every item on a character.
//   flags.babele              Dropped. These were stamped by Babele on the COMPENDIUM document and
//                             rode along in the copy; on the copy they claim it is already translated
//                             (`hasTranslation`), so the very tool they belong to skips it.
//
// Ungated, and cheap to repeat: an item that already has a source and no stray flags is skipped
// without a write.
export async function migrateItemProvenance(actor, provenance = new PackProvenance()) {
	const updates = [];
	for (const item of actor.items ?? []) {
		const hasSource = !!item._stats?.compendiumSource;
		const hasBabele = !!item.flags?.babele;
		if (hasSource && !hasBabele) continue;

		const update = { _id: item._id };
		if (!hasSource) {
			const uuid = await provenance.uuidFor(item.type, item.system?.slug);
			if (uuid) update["_stats.compendiumSource"] = uuid;
		}
		// Foundry MERGES an object-field update rather than replacing it, so the flags have to be
		// deleted by key — writing `flags.babele: null` would leave the old keys in place.
		if (hasBabele) update["flags.-=babele"] = null;

		if (Object.keys(update).length > 1) updates.push(update);
	}
	if (!updates.length) return;

	info(`Stamping the compendium source on ${updates.length} embedded item(s).`);
	await actor.updateEmbeddedDocuments("Item", updates);
}
