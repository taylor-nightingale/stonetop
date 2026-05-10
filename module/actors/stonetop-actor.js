import { StonetopCharacterActor } from "./character/character-actor.js";

export function createStonetopActorClass(BaseActor) {
	return class StonetopActor extends BaseActor {
		async _onCreateDescendantDocuments(parent, collection, documents, data, options, userId) {
			await super._onCreateDescendantDocuments(parent, collection, documents, data, options, userId);
			if (this.type === "character" && collection === "items") {
				await new StonetopCharacterActor(this).onPlaybookAdded(documents);
			}
		}
	};
}
