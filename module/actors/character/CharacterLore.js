import { ChoiceGroup, ChoiceValues } from "../../model/snapshot/character/ChoiceGroup.js";

export class CharacterLore {
	constructor(flags) {
		this._flags = flags;
	}

	get values() {
		return new ChoiceValues(this._flags.getFlag("values") ?? {});
	}

	async set(groupSlug, optionSlug, value) {
		await this._flags.setFlag("values", this.values.set(groupSlug, optionSlug, value).toRaw());
	}

	buildSnapshot(loreData) {
		return (loreData ?? []).map(entry => ChoiceGroup.fromPackData(entry, this.values));
	}
}
