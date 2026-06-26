import { OutfitItemBuilder } from "../../../model/OutfitItem.js";
import { FoundryPackStore } from "./FoundryPackStore.js";
import { ITEM_FLAG_SCOPE } from "../StonetopFlags.js";

const FIELDS = [
	"system.moveType",
	...["slug", "inventoryColumn", "sortOrder", "weight", "note", "resource",
	    "prosperityResource", "breakBefore", "smallGrid", "twoCol", "armor",
	    "special", "specialCategory"]
		.map(f => `flags.${ITEM_FLAG_SCOPE}.${f}`),
];

export class FoundryOutfitItemRepository {
	constructor() {
		this._store = new FoundryPackStore("stonetop.stonetop-items", FIELDS);
		this._cache = null;
	}

	async getAll() {
		if (this._cache) return this._cache;
		const entries = await this._store.filterEntries(e => e.system?.moveType === "inventory");
		this._cache = entries
			.sort((a, b) => (a.flags?.[ITEM_FLAG_SCOPE]?.sortOrder ?? 0) - (b.flags?.[ITEM_FLAG_SCOPE]?.sortOrder ?? 0))
			.map(item => {
				const st = item.flags?.[ITEM_FLAG_SCOPE] ?? {};
				return new OutfitItemBuilder()
					.withSlug(st.slug)
					.withName(item.name)
					.withWeight(st.weight ?? 0)
					.withNote(st.note ?? null)
					.withInventoryColumn(st.inventoryColumn ?? null)
					.withResource(st.resource ?? null)
					.withProsperityResource(st.prosperityResource ?? false)
					.withTwoCol(st.twoCol ?? false)
					.withSmallGrid(st.smallGrid ?? false)
					.withBreakBefore(st.breakBefore ?? false)
					.withArmor(st.armor ?? null)
					.withSpecial(st.special ?? false)
					.withSpecialCategory(st.specialCategory ?? null)
					.build();
			});
		return this._cache;
	}
}
