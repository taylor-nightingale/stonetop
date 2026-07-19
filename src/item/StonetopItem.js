import {StonetopPlaybook} from "./StonetopPlaybook.js";
import {StonetopSteadfast} from "./StonetopSteadfast.js";

export function createStonetopItemClass(BaseItem) {
	return class StonetopItem extends BaseItem {

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
