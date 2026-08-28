import { OutfitItem } from "../../../model/data/character/OutfitItem.js";
import { FoundryPackStore } from "./FoundryPackStore.js";

const FIELDS = [
	"system.slug", "system.qualifier", "system.inventoryColumn",
	"system.weight", "system.tagList", "system.note", "system.resource",
	"system.armor",
];

/**
 * The gear catalog: every `outfitItem` the compendium holds.
 *
 * Flat, and deliberately so. WHAT A SHEET DRAWS is decided by the inventory page
 * (src/model/data/character/inventoryInsertPage.js), which names the gear it lists by slug. Where an
 * item is filed in the compendium is shelving for a human browsing it and means nothing here.
 *
 * This used to reconstruct the printed sheet by walking the folder tree and taking everything under
 * "Default" — which is how 46 rows of the value tables once became a permanent row on every
 * character in the world, unremovable because nobody had granted them. Membership is a list now, and
 * the list is readable.
 */
export class FoundryOutfitItemRepository {
	constructor() {
		this._store  = new FoundryPackStore("stonetop.outfit-items", FIELDS);
		this._all    = null;
		this._bySlug = null;
	}

	/** Every item in the compendium — the printed checklist's gear and the catalog behind it alike. */
	async getAll() {
		await this._load();
		return this._all;
	}

	/** slug → item: how a page resolves the rows it names. */
	async bySlug() {
		await this._load();
		return this._bySlug;
	}

	async _load() {
		if (this._all) return;
		this._all    = (await this._store.getAll()).map(entry => OutfitItem.fromDocument(entry));
		this._bySlug = new Map(this._all.map(item => [item.slug, item]));
	}
}
