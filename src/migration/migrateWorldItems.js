import { warn } from "../utils/logger.js";

export async function migrateWorldItems() {
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
