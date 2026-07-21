import { OutfitItem } from "../../../model/data/character/OutfitItem.js";
import { FoundryPackStore } from "./FoundryPackStore.js";
import { WorldItemStore } from "./WorldItemStore.js";

const FIELDS = [
	"system.slug", "system.inventoryColumn",
	"system.weight", "system.tagList", "system.note", "system.resource",
	"system.twoCol", "system.armor",
	"folder",
];

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
		const packItems  = entries.map(item => OutfitItem.fromDocument(item, folders.get(item.folder) ?? null));
		const worldItems = worldEntries.map(item => OutfitItem.fromDocument(item));
		// Pack order is the authored order (the compendium's own sequence); world items trail it.
		this._cache = [...packItems, ...worldItems];
		return this._cache;
	}
}
