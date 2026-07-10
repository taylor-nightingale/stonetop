import {StonetopPlaybook} from "./StonetopPlaybook.js";
import {StonetopSteadfast} from "./StonetopSteadfast.js";
import {renderRollCard} from "../utils/rollCard.js";
import {rich} from "../model/snapshot/RichText.js";

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

		async roll({ rollMode = "normal", descriptionOnly = false } = {}) {
			if (!this.actor) {
				const speaker = ChatMessage.getSpeaker({ actor: undefined });
				const card = { name: this.name, description: rich(this.system?.description ?? "") };
				return ChatMessage.create({ speaker, content: await renderRollCard(card, this.getRollData?.() ?? {}) });
			}
			return this.actor._executeRoll(this, { rollMode, descriptionOnly });
		}
	};
}
