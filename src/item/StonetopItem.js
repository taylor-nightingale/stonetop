import {StonetopPlaybook} from "./StonetopPlaybook.js";
import {StonetopSteadfast} from "./StonetopSteadfast.js";
import {ItemSlugCatalog} from "./ItemSlugCatalog.js";

export function createStonetopItemClass(BaseItem) {
	return class StonetopItem extends BaseItem {

		async _preCreate(data, options, user) {
			const allowed = await super._preCreate(data, options, user);
			if (allowed === false) return false;
			await this.#claimFreeSlug();
		}

		// A world item copied from a compendium (or duplicated in the sidebar) arrives carrying the
		// source's slug, and a world item wins every slug lookup (FoundryMoveRepository#buildSlugIndex),
		// so the copy would shadow the item it was copied from. Give the copy a slug of its own.
		// Items embedded on an actor keep theirs: grants match an owned item to its source by slug.
		async #claimFreeSlug() {
			if (this.parent || this.pack) return;
			const slug = this.system?.slug;
			if (!slug) return;
			const free = await ItemSlugCatalog.forType(this.type).uniqueSlug(slug);
			if (free !== slug) this.updateSource({ "system.slug": free });
		}

		asPlaybook() {
			return new StonetopPlaybook(this);
		}

		// The typed view of this item, built lazily and cached (mirrors Actor.typedActor). Only steadfast
		// items have one today — other types return null.
		get typedItem() {
			if (this._typedItem) return this._typedItem;
			if (this.type === "steadfast") this._typedItem = new StonetopSteadfast(this);
			return this._typedItem ?? null;
		}
	};
}
