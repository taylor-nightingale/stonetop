import {StonetopCharacter} from "./character/StonetopCharacter.js";
import {StonetopSteading} from "./steading/StonetopSteading.js";
import {StonetopNpc} from "./npc/StonetopNpc.js";
import {ActorRolling} from "./ActorRolling.js";
import {RollRequest} from "./RollRequest.js";

export function createStonetopActorClass(BaseActor) {
	return class StonetopActor extends BaseActor {
		_typedActor;

		constructor(...args) {
			super(...args);
		}

		get typedActor() {
			if (this._typedActor) return this._typedActor;

			switch (this.type) {
				case "character":
					this._typedActor = StonetopCharacter.create(this);
					break;
				case "npc":
					this._typedActor = StonetopNpc.create(this);
					break;
				case "steading":
					this._typedActor = new StonetopSteading(this);
					break;
			}

			return this._typedActor;
		}

		get _rolling() {
			return this.__rolling ??= new ActorRolling(this);
		}

		// -- Lifecycle ---------------------------------------------

		async _onRoll(event) {
			const rollStat    = event.target.closest("[data-roll]")?.dataset.roll || null;
			const itemId      = event.target.closest(".item")?.dataset.itemId;
			const item        = itemId ? this.items.get(itemId) : null;

			if (itemId && !item) return false;
			if (!rollStat && !item) return false;

			const rollMode = this.typedActor.rollMode;
			const isDescription = event.target.getAttribute("data-show") === "description";

			const request = item
				? RollRequest.fromItem(item, rollStat, rollMode)
				: RollRequest.fromStat(rollStat, rollMode);

			await this._rolling.execute(request, {descriptionOnly: isDescription});
			return true;
		}

		static defaultName({type, parent, pack} = {}) {
			const key = `stonetop.actor.defaultName.${type}`;
			return game.i18n.has(key) ? game.i18n.localize(key) : super.defaultName({type, parent, pack});
		}

		async _onCreateDescendantDocuments(parent, collection, documents, data, options, userId) {
			await super._onCreateDescendantDocuments(parent, collection, documents, data, options, userId);
			if (this.typedActor.type === "character" && collection === "items") {
				await this.typedActor._onCreateDescendantDocuments(documents);
			}
		}

		async _onDeleteDescendantDocuments(parent, collection, documents, ids, options, userId) {
			await super._onDeleteDescendantDocuments(parent, collection, documents, ids, options, userId);
			if (this.typedActor.type === "character" && collection === "items") {
				await this.typedActor._onDeleteDescendantDocuments(documents);
			}
		}
	};
}
