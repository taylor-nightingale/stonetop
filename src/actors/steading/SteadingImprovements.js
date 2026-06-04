import {ChoiceGroup, ChoiceValues} from "../../model/snapshot/character/ChoiceGroup.js";
import {FoundrySteadingImprovementRepository} from "./repositories/FoundrySteadingImprovementRepository.js";

export class SteadingImprovements {
	constructor(actor, repo = new FoundrySteadingImprovementRepository()) {
		this._actor = actor;
		this._repo  = repo;
	}

	get _values() {
		return new ChoiceValues(this._actor.system?.improvements?.pickValues ?? {});
	}

	async setTrack(groupSlug, optionSlug, count) {
		const cv = this._values.set(groupSlug, optionSlug, count);
		await this._actor.update({ "system.improvements.pickValues": cv.toRaw() });
	}

	async buildSnapshot() {
		const all = await this._repo.getAll();
		return all
			.filter(imp => imp.choices != null)
			.map(imp => ChoiceGroup.fromPackData(imp.choices, this._values));
	}
}
