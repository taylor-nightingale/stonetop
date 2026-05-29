import {StonetopCharacter} from "./character/StonetopCharacter.js";
import {StonetopSteading} from "./steading/StonetopSteading.js";

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
				case "stonetop.steading":
					this._typedActor = new StonetopSteading(this);
					break;
			}

			return this._typedActor;
		}


		// -- Lifecycle ---------------------------------------------
		// Method names can not change, they are called by pbta system
		async _onRoll(event) {
			if (this.type === "character") {
				const handled = await this.typedActor.onRoll(event);
				if (handled) return;
			}
			return super._onRoll(event);
		}

		async _onRollStat(stat, label, options = {}) {
			if (this.type === "character") {
				options = this.typedActor.applyDebilityRollMode(stat, options);
			}
			return super._onRollStat(stat, label, options);
		}

		async _onCreateDescendantDocuments(parent, collection, documents, data, options, userId) {
			await super._onCreateDescendantDocuments(parent, collection, documents, data, options, userId);
			if (this.typedActor.type === "character" && collection === "items") {
				await this.typedActor._onCreateDescendantDocuments(documents);
			}
		}
	};
}
