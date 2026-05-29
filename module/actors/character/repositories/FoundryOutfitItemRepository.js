import { OutfitItemBuilder } from "../../../model/data/character/OutfitItem.js";
import { FoundryPackStore } from "./FoundryPackStore.js";

const FIELDS = [
	"flags.stonetop.slug", "flags.stonetop.inventoryColumn", "flags.stonetop.sortOrder",
	"flags.stonetop.weight", "flags.stonetop.note", "flags.stonetop.resource",
	"flags.stonetop.twoCol", "flags.stonetop.armor",
	"folder",
];

export class FoundryOutfitItemRepository {
	constructor() {
		this._store = new FoundryPackStore("stonetop.outfit-items", FIELDS);
		this._cache = null;
	}

	async getAll() {
		if (this._cache) return this._cache;
		const entries = await this._store.getAll();
		const folders = await this._store.getFolders();
		this._cache = entries
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
					.withGroup(folders.get(item.folder) ?? null)
					.withArmor(st.armor ?? null)
					.build();
			});
		return this._cache;
	}
}
