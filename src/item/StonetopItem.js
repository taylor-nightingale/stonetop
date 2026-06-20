import {StonetopPlaybook} from "./StonetopPlaybook.js";

export function createStonetopItemClass(BaseItem) {
	return class StonetopItem extends BaseItem {

		asPlaybook() {
			return new StonetopPlaybook(this);
		}

		async roll({ rollMode = "normal", descriptionOnly = false } = {}) {
			if (!this.actor) {
				const speaker = ChatMessage.getSpeaker({ actor: undefined });
				return ChatMessage.create({ speaker, content: `<h3>${this.name}</h3>${this.system?.description ?? ""}` });
			}
			return this.actor._executeRoll(this, { rollMode, descriptionOnly });
		}
	};
}
