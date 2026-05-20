import { OutfitItemBuilder } from "../../../model/OutfitItem.js";

let _cache = null;

export class FoundryOutfitItemRepository {
	async getAll() {
		if (_cache) return _cache;
		const pack = game.packs.get("stonetop.inventory-items");
		if (!pack) return [];
		await pack.getIndex({ fields: [
			"flags.stonetop.slug", "flags.stonetop.inventoryColumn", "flags.stonetop.sortOrder",
			"flags.stonetop.weight", "flags.stonetop.note", "flags.stonetop.resource",
			"flags.stonetop.breakBefore", "flags.stonetop.smallGrid", "flags.stonetop.twoCol",
		]});
		_cache = [...pack.index]
			.sort((a, b) => (a.flags?.stonetop?.sortOrder ?? 0) - (b.flags?.stonetop?.sortOrder ?? 0))
			.map(item => {
				const st = item.flags?.stonetop ?? {};
				return new OutfitItemBuilder()
					.withSlug(st.slug)
					.withName(item.name)
					.withWeight(st.weight ?? 0)
					.withNote(st.note ?? null)
					.withInventoryColumn(st.inventoryColumn ?? null)
					.withResource(st.resource ?? null)
					.withTwoCol(st.twoCol ?? false)
					.withSmallGrid(st.smallGrid ?? false)
					.withBreakBefore(st.breakBefore ?? false)
					.build();
			});
		return _cache;
	}
}
