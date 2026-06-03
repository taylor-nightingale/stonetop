import { OutfitItemBuilder } from "../../../model/data/character/OutfitItem.js";
import { FoundryPackStore } from "./FoundryPackStore.js";
import { WorldItemStore } from "./WorldItemStore.js";

const FIELDS = [
	"system.slug", "system.inventoryColumn", "system.sortOrder",
	"system.weight", "system.tags", "system.note", "system.resource",
	"system.twoCol", "system.armor",
	"folder",
];

function _toOutfitItem(item, group = null) {
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
		.withGroup(group)
		.withArmor(sys.armor ?? null)
		.build();
}

export class FoundryOutfitItemRepository {
	constructor() {
		this._store      = new FoundryPackStore("stonetop.outfit-items", FIELDS);
		this._worldStore = new WorldItemStore("outfitItem");
		this._cache      = null;
	}

	async getAll() {
		if (this._cache) return this._cache;
		const entries = await this._store.getAll();
		const [worldEntries, folders] = await Promise.all([
			this._worldStore.getAll(),
			this._store.getFolders(),
		]);
		const packItems  = entries.map(item => _toOutfitItem(item, folders.get(item.folder) ?? null));
		const worldItems = worldEntries.map(item => _toOutfitItem(item));
		this._cache = [...packItems, ...worldItems]
			.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
		return this._cache;
	}
}
