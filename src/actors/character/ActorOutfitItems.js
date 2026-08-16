import { GrantedItems } from "../GrantedItems.js";
import { GrantSource, ItemGrant, ItemGrantSet } from "../../model/data/ItemGrant.js";

/**
 * The character's `outfitItem` documents. Reads them; writes go through the shared granted-item store
 * like every other item something else owns.
 *
 * Outfit gear is the one grant that is REPLACED rather than diffed: it carries no player state (what is
 * held lives in `system.inventory.checked`, keyed by slug), it is recomputed whole every time a choice
 * is ticked, and two identical items from one container are two real items — so there is nothing to
 * preserve and nothing to key on.
 */
export class ActorOutfitItems {
	constructor(actor, grantedItems = new GrantedItems(actor)) {
		this._actor        = actor;
		this._grantedItems = grantedItems;
	}

	get _all() {
		return [...(this._actor.items ?? [])].filter(i => i.type === "outfitItem");
	}

	getAll() {
		return this._all;
	}

	async create(itemsData) {
		await this._grantedItems.addAuthored(itemsData);
	}

	async deleteBySources(sources) {
		await this._grantedItems.revokeAll(sources.map(GrantSource.outfit));
	}

	async deleteById(id) {
		await this._actor.deleteEmbeddedDocuments("Item", [id]);
	}

	async sync(source, itemsData) {
		await this._grantedItems.replace(new ItemGrantSet(
			GrantSource.outfit(source),
			itemsData.map(data => new ItemGrant(data)),
		));
	}
}
