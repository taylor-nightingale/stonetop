import {ChoiceGroup, ChoiceValues} from "../../model/snapshot/character/ChoiceGroup.js";
import {FoundrySteadingImprovementRepository} from "./repositories/FoundrySteadingImprovementRepository.js";

// A steading renders only the improvements it OWNS — the slugs in system.improvements (copied from its
// steadfast on apply, plus any wonder improvements dropped later). The repository resolves each slug to
// its choice-group content; pick/track state lives in system.improvementValues, keyed by group slug.
export class SteadingImprovements {
	constructor(actor, repo = new FoundrySteadingImprovementRepository()) {
		this._actor = actor;
		this._repo  = repo;
	}

	get _slugs() {
		return this._actor.system.improvements ?? [];
	}

	get _values() {
		return new ChoiceValues(this._actor.system?.improvementValues ?? {});
	}

	async setTrack(groupSlug, optionSlug, count) {
		const cv = this._values.set(groupSlug, optionSlug, count);
		await this._actor.update({ "system.improvementValues": cv.toRaw() });
	}

	async buildSnapshot() {
		const values = this._values;
		const groups = [];
		for (const slug of this._slugs) {
			const imp = await this._repo.getBySlug(slug);
			if (imp?.choices != null) groups.push(ChoiceGroup.fromPackData(imp.choices, values));
		}
		return groups;
	}
}
