import { ChoiceValues } from "../../model/snapshot/character/ChoiceGroup.js";
import { ChoiceGroupController } from "../character/ChoiceGroupController.js";

// The steading's own choice-group values, in system.choiceValues — the store behind the `steading`
// context. Routing between contexts is the steading's ChoiceStores; this just owns the one store.
export class SteadingChoices {
	constructor(actor) {
		this._actor      = actor;
		this._controller = new ChoiceGroupController({
			reader: () => this._actor.system?.choiceValues ?? {},
			writer: raw => this._actor.update({ "system.choiceValues": raw }),
		});
	}

	/** The store the steading's own choice rows write through — resolved per context by the steading's ChoiceStores. */
	controller() {
		return this._controller;
	}

	get values() {
		return new ChoiceValues(this._actor.system?.choiceValues ?? {});
	}
}
