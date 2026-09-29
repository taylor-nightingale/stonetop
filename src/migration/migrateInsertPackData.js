import { info } from "../utils/logger.js";

// Refresh an owned insert's authored fields from the pack, matched by slug. An owned insert is a copy
// taken when it was gained, so a pack fix never reaches a character in play otherwise.
//
// The player's choices (choiceValues) and the item's name survive by omission. Inserts the pack does
// not know — homebrew — are left alone.
export async function migrateInsertPackData(actor, insertRepo) {
	const items = [...actor.items].filter(i => i.type === "insert" && i.system?.slug);
	if (!items.length) return;

	const updates = [];
	for (const item of items) {
		const doc = await insertRepo.findBySlug(item.system.slug);
		const sys = doc?.toObject?.().system ?? doc?.system ?? null;
		if (!sys) continue;
		updates.push({
			_id: item._id,
			system: {
				description: sys.description ?? "",
				instinct:    sys.instinct    ?? null,
				choices:     sys.choices     ?? [],
			},
		});
	}
	if (!updates.length) return;

	info(`Refreshing ${updates.length} embedded insert(s) from pack data.`);
	// Foundry merges an object-field update, so the instinct is cleared first or a key the pack has
	// dropped would survive. `choices` is an array and is replaced whole.
	await actor.updateEmbeddedDocuments("Item", updates.map(u => ({ _id: u._id, system: { instinct: null } })));
	await actor.updateEmbeddedDocuments("Item", updates);
}
