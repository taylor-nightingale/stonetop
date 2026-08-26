import {StonetopPlaybook} from "./StonetopPlaybook.js";
import {TranslationCatalog} from "../i18n/TranslationCatalog.js";
import {StonetopSteadfast} from "./StonetopSteadfast.js";

export function createStonetopItemClass(BaseItem) {
	return class StonetopItem extends BaseItem {

		// Compendium prose is translated onto the PREPARED document, never into `_source`: the packs
		// stay English, so `toObject()`, every write back and every migration still see the English the
		// pack was built from, and switching the world's language switches the text rather than
		// stacking one translation on top of another.
		prepareBaseData() {
			super.prepareBaseData();
			TranslationCatalog.current.applyTo(this);
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
