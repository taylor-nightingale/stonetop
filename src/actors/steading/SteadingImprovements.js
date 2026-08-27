import {ChoiceValues} from "../../model/snapshot/character/ChoiceGroup.js";
import {ChoiceGroupController} from "../character/ChoiceGroupController.js";
import {buildChoiceGroup} from "../../model/snapshot/character/buildChoiceGroup.js";
import {FoundrySteadingImprovementRepository} from "./repositories/FoundrySteadingImprovementRepository.js";
import {addImprovement, removeImprovement} from "../../model/data/steading/improvementSlugs.js";

// A steading renders only the improvements it OWNS — the slugs in system.improvements (copied from its
// steadfast on apply, plus any wonder improvements dropped later). The repository resolves each slug to
// its choice-group content; pick/track state lives in system.improvementValues, keyed by group slug.
export class SteadingImprovements {
	constructor(actor, repo = new FoundrySteadingImprovementRepository()) {
		this._actor = actor;
		this._repo  = repo;
		// Through a controller like every other choice store, so improvement rows route through the
		// shared choice wiring rather than needing the sheet to know they are special.
		this._controller = new ChoiceGroupController({
			reader: () => this._actor.system?.improvementValues ?? {},
			writer: raw => this._actor.update({ "system.improvementValues": raw }),
		});
	}

	/** The store improvement choice rows write through — resolved per context by the steading's ChoiceStores. */
	controller() {
		return this._controller;
	}

	get _slugs() {
		return this._actor.system.improvements ?? [];
	}

	get _values() {
		return new ChoiceValues(this._actor.system?.improvementValues ?? {});
	}

	// An improvement dropped onto the steading joins the owned list by slug — no embed, since the tab
	// renders from these slugs. Re-dropping one it already owns is a no-op.
	async grant(slug) {
		const next = addImprovement(this._slugs, slug);
		if (next.length !== this._slugs.length) await this._actor.update({ "system.improvements": next });
	}

	// Track/pick state for the group is deliberately left in improvementValues — orphaned but harmless,
	// so an accidental revoke (or a re-grant later) doesn't lose the steading's progress. Re-applying a
	// steadfast already replaces the slug list on the same terms.
	async revoke(slug) {
		await this._actor.update({ "system.improvements": removeImprovement(this._slugs, slug) });
	}

	async buildSnapshot() {
		const values = this._values;
		const groups = [];
		for (const slug of this._slugs) {
			const imp = await this._repo.getBySlug(slug);
			if (imp?.choices != null) groups.push(buildChoiceGroup(imp.titledChoices, values));
		}
		return groups;
	}
}
