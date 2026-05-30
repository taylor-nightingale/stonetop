import { ChoiceGroup, ChoiceValues } from "../../model/snapshot/character/ChoiceGroup.js";

export class ChoiceGroupController {
	constructor(flags) {
		this._flags = flags;
	}

	get _values() {
		return new ChoiceValues(this._flags.getFlag("values") ?? {});
	}

	buildGroup(groupData) {
		return ChoiceGroup.fromPackData(groupData, this._values);
	}

	async selectOption(groupSlug, slug, siblingSlugsCsv) {
		let values = this._values;
		if (siblingSlugsCsv) {
			for (const sib of siblingSlugsCsv.split(",")) values = values.set(groupSlug, sib, 0);
		}
		values = values.set(groupSlug, slug, 1);
		await this._flags.setFlag("values", values.toRaw());
	}

	async setCount(groupSlug, optionSlug, count) {
		await this._flags.setFlag("values", this._values.set(groupSlug, optionSlug, count).toRaw());
	}

	async setText(groupSlug, optionSlug, text) {
		await this._flags.setFlag("values", this._values.set(groupSlug, optionSlug, text).toRaw());
	}

	async clearValues() {
		await this._flags.setFlag("values", {});
	}
}
