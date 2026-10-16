import { warn } from "../utils/logger.js";
import { toSlug } from "../utils/slug.js";
import { migrateWorldImprovementRules } from "./migrateWorldImprovementRules.js";

// Stamp a stable `system.slug` (= toSlug(name)) onto world move items that lack one, so references
// to them survive a rename. Only fills the gap; never overwrites an existing slug.
export async function migrateWorldMoveSlugs() {
	const updates = (game.items ?? [])
		.filter(i => i.type === "move" && !i.system?.slug)
		.map(i => ({ _id: i.id, system: { slug: toSlug(i.name) } }));
	if (updates.length) await Item.updateDocuments(updates);
}

// Legacy `npc`-type follower world items → `follower` (create + delete; type is immutable in place).
// Same pattern as the equipment → arcanum conversion below.
export async function migrateWorldFollowerItemType() {
	const legacy = (game.items ?? []).filter(i => i.type === "npc");
	if (!legacy.length) return;
	const created = legacy.map(item => {
		const o = item.toObject?.() ?? item;
		return { name: o.name, img: o.img ?? null, folder: item.folder?.id ?? null, type: "follower", system: o.system ?? {}, flags: o.flags ?? {} };
	});
	// Batch both writes (matches the actor-side migrateFollowerItemType) instead of a create+delete
	// round-trip per item.
	await Item.createDocuments(created);
	await Item.deleteDocuments(legacy.map(i => i.id));
}

export async function migrateWorldItems() {
	await migrateWorldMoveSlugs();
	await migrateWorldFollowerItemType();
	await migrateWorldImprovementRules();

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
				slug:         sys.slug  ?? null,
				major:        sys.major ?? false,
				front:        sys.front,
				back:         sys.back,
				flipped:      false,
				choiceValues: {},
			},
		});
		await item.delete();
	}
}
