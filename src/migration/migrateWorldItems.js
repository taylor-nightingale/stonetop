import { warn } from "../utils/logger.js";
import { toSlug } from "../utils/slug.js";

// Stamp a stable `system.slug` (= toSlug(name)) onto world move items that lack one, so references
// to them survive a rename. Only fills the gap; never overwrites an existing slug.
export async function migrateWorldMoveSlugs() {
	const updates = (game.items ?? [])
		.filter(i => i.type === "move" && !i.system?.slug)
		.map(i => ({ _id: i.id, system: { slug: toSlug(i.name) } }));
	if (updates.length) await Item.updateDocuments(updates);
}

export async function migrateWorldItems() {
	await migrateWorldMoveSlugs();

	const equipmentItems = (game.items ?? []).filter(i => i.type === "equipment");
	for (const item of equipmentItems) {
		const sys = item.toObject?.()?.system ?? item.system ?? {};
		if (!sys.front && !sys.back) {
			warn(`World item "${item.name}" has type=equipment but no front/back — skipping`);
			continue;
		}
		await Item.create({
			name:   item.name,
			img:    item.img ?? null,
			folder: item.folder?.id ?? null,
			type:   "arcanum",
			system: {
				slug:             sys.slug  ?? null,
				major:            sys.major ?? false,
				front:            sys.front,
				back:             sys.back,
				flipped:          false,
				unlockValues:     {},
				backChoiceValues: {},
			},
		});
		await item.delete();
	}
}
