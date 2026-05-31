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
				case "steading":
					this._typedActor = new StonetopSteading(this);
					break;
			}

			return this._typedActor;
		}


		// -- Lifecycle ---------------------------------------------
		async _onRoll(event) {
			if (this.type === "character") {
				return await this.typedActor.onRoll(event);
			}
			return false;
		}

		async _onRollStat(stat, label, options = {}) {
			if (this.type === "character") {
				options = this.typedActor.applyDebilityRollMode(stat, options);
			}
			return this.sheet._onRollStat(stat, label, options);
		}

		async _onCreateDescendantDocuments(parent, collection, documents, data, options, userId) {
			await super._onCreateDescendantDocuments(parent, collection, documents, data, options, userId);
			if (this.typedActor.type === "character" && collection === "items") {
				await this.typedActor._onCreateDescendantDocuments(documents);
			}
		}
	};
}
