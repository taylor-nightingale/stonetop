import { OutfitItem } from "../../../model/data/character/OutfitItem.js";
import { FoundryPackStore } from "./FoundryPackStore.js";

const FIELDS = [
	"system.slug", "system.inventoryColumn",
	"system.weight", "system.tagList", "system.note", "system.resource",
	"system.twoCol", "system.armor",
	"folder",
];

// The compendium's "Default" folder: Book I's Inventory insert (printed p. 142), which is the gear the
// printed character sheet lays out as a checklist. Everything else in the pack — the Special items the
// value tables price (pp. 96-97) — is a catalog to drag from, and a sheet must not list it: an item
// there would be a permanent row on EVERY character, which nobody can remove because nobody granted it.
const DEFAULT_FOLDER = "StOnEtOpDef0001X";

export class FoundryOutfitItemRepository {
	constructor() {
		this._store  = new FoundryPackStore("stonetop.outfit-items", FIELDS);
		this._all    = null;
		this._insert = null;
	}

	/** Every item in the compendium — the printed checklist plus the catalog behind it. */
	async getAll() {
		await this._load();
		return this._all;
	}

	/** Only what the Inventory insert prints: the rows a character sheet's Outfit tab draws. */
	async getInsertItems() {
		await this._load();
		return this._insert;
	}

	async _load() {
		if (this._all) return;
		// Compendium order is the authored order (the pack's own sequence).
		const entries = await this._store.getAll();
		const folders = await this._store.getFolders();
		const toItem  = entry => OutfitItem.fromDocument(entry, folders.nameOf(entry.folder));
		this._all     = entries.map(toItem);
		this._insert  = entries.filter(e => folders.isUnder(e.folder, DEFAULT_FOLDER)).map(toItem);
	}
}
