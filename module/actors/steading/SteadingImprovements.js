import {StonetopFlags} from "../character/StonetopFlags.js";
import {ChoiceGroup, ChoiceValues} from "../../model/snapshot/character/ChoiceGroup.js";
import {FoundrySteadingImprovementRepository} from "./repositories/FoundrySteadingImprovementRepository.js";

export class SteadingImprovements {
	constructor(actor, repo = new FoundrySteadingImprovementRepository()) {
		this._flags = new StonetopFlags(actor, "improvements");
		this._repo = repo;
	}

	get _values() {
		return new ChoiceValues(this._flags.getFlag("pickValues") ?? {});
	}

	async setTrack(groupSlug, optionSlug, count) {
		const cv = this._values.set(groupSlug, optionSlug, count);
		await this._flags.setFlag("pickValues", cv.toRaw());
	}

	async buildSnapshot() {
		const all = await this._repo.getAll();
		return all
			.filter(imp => imp.choices != null)
			.map(imp => ChoiceGroup.fromPackData(imp.choices, this._values));
	}
}
