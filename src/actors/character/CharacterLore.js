import { ChoiceGroup, ChoiceValues } from "../../model/snapshot/character/ChoiceGroup.js";

export class CharacterLore {
	constructor(actor, systemSection = "lore") {
		this._actor   = actor;
		this._section = systemSection;
	}

	get values() {
		return new ChoiceValues(this._actor.system?.[this._section]?.values ?? {});
	}

	async set(groupSlug, optionSlug, value) {
		await this._actor.update({
			[`system.${this._section}.values`]: this.values.set(groupSlug, optionSlug, value).toRaw(),
		});
	}

	buildSnapshot(loreData) {
		return (loreData ?? []).map(entry => ChoiceGroup.fromPackData(entry, this.values));
	}
}
