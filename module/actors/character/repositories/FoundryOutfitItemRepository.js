import { OutfitItemBuilder } from "../../../model/data/character/OutfitItem.js";
import { FoundryPackStore } from "./FoundryPackStore.js";

const FIELDS = [
	"system.slug", "system.inventoryColumn", "system.sortOrder",
	"system.weight", "system.tags", "system.note", "system.resource",
	"system.twoCol", "system.armor",
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
			.sort((a, b) => (a.system?.sortOrder ?? 0) - (b.system?.sortOrder ?? 0))
			.map(item => {
				const sys = item.system ?? {};
				return new OutfitItemBuilder()
					.withSlug(sys.slug)
					.withName(item.name)
					.withWeight(sys.weight ?? 0)
					.withTags(sys.tags ?? "")
					.withNote(sys.note ?? null)
					.withInventoryColumn(sys.inventoryColumn ?? null)
					.withResource(sys.resource ?? null)
					.withTwoCol(sys.twoCol ?? false)
					.withGroup(folders.get(item.folder) ?? null)
					.withArmor(sys.armor ?? null)
					.build();
			});
		return this._cache;
	}
}
