import { OutfitItem } from "../../../model/data/character/OutfitItem.js";
import { FoundryPackStore } from "./FoundryPackStore.js";

const FIELDS = [
	"system.slug", "system.inventoryColumn",
	"system.weight", "system.tagList", "system.note", "system.resource",
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
		// Compendium order is the authored order (the pack's own sequence).
		this._cache = entries.map(item => OutfitItem.fromDocument(item, folders.get(item.folder) ?? null));
		return this._cache;
	}
}
