import { ChoiceValues } from "../../model/snapshot/character/ChoiceGroup.js";
import { ChoiceGroupController, applyPick } from "../character/ChoiceGroupController.js";

// The steading's choice-group picks, in system.choiceValues. One store, so unlike the character
// there is nothing to route between: the controller IS the store. It exists so picks go through the
// same machinery as everywhere else — in particular selectOption's sibling clearing, which is what
// makes a "pick 1" row releasable rather than a checkbox that can only ever be ticked.
export class SteadingChoices {
	constructor(actor) {
		this._actor      = actor;
		this._controller = new ChoiceGroupController({
			reader: () => this._actor.system?.choiceValues ?? {},
			writer: raw => this._actor.update({ "system.choiceValues": raw }),
		});
	}

	get values() {
		return new ChoiceValues(this._actor.system?.choiceValues ?? {});
	}

	async setPickFor(target, checked = true) {
		if (!target?.group || !target.option) return;
		return applyPick(this._controller, target, checked);
	}
}
