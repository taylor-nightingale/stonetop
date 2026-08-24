import { escapeHtml } from "../../utils/confirmAction.js";

/**
 * What a bulk pass over one roster would do — the PersonActorPlan rows grouped by what they mean,
 * and able to say so in the GM's own words.
 */
export class PersonActorPlans {
	constructor(plans = []) {
		this._plans = plans;
	}

	get toCreate() { return this._plans.filter(plan => plan.willCreate); }
	get toLink()   { return this._plans.filter(plan => plan.willLink); }
	get hasWork()  { return this.toCreate.length > 0 || this.toLink.length > 0; }

	// Creating and linking are described separately: linking a row to an actor that already exists
	// adds nothing to the world, and one sentence covering both would misrepresent what the GM is
	// agreeing to. A group with no members contributes no sentence at all.
	describe() {
		return [
			PersonActorPlans._sentence("creating", this.toCreate),
			PersonActorPlans._sentence("linking", this.toLink),
			game.i18n.localize("stonetop.steading.createActors.proceed"),
		].filter(Boolean).join(" ");
	}

	static _sentence(key, plans) {
		if (plans.length === 0) return null;
		return game.i18n.format(`stonetop.steading.createActors.${key}`, {
			count: plans.length,
			names: escapeHtml(plans.map(plan => plan.name).join(", ")),
		});
	}
}
