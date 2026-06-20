import {DebilitySnapshotBuilder} from "../../model/snapshot/character/CharacterSnapshot.js";

const _DEBILITY_DEFS = [
	{key: "weakened",  name: "Weakened",  stats: ["str", "dex"]},
	{key: "dazed",     name: "Dazed",     stats: ["int", "wis"]},
	{key: "miserable", name: "Miserable", stats: ["con", "cha"]},
];

export class CharacterDebilities {
	constructor(actor) {
		this._actor = actor;
	}

	async setDebility(slug, value) {
		await this._actor.update({
			[`system.attributes.debilities.options.${slug}.value`]: value,
		});
	}

	buildDebilitiesSnapshot() {
		const opts = this._actor.system?.attributes?.debilities?.options ?? {};
		return _DEBILITY_DEFS.map(({key, name, stats}) =>
			new DebilitySnapshotBuilder()
				.withKey(key)
				.withName(name)
				.withActive(!!(opts[key]?.value))
				.withStats(stats)
				.build()
		);
	}

	applyDebilityRollMode(stat, options) {
		const debilityOptions = this._actor.system?.attributes?.debilities?.options ?? {};
		const hasActiveDebility = _DEBILITY_DEFS.some(
			def => def.stats.includes(stat) && !!(debilityOptions[def.key]?.value)
		);
		if (!hasActiveDebility) return options;
		if (options.rollMode === "adv") return {...options, rollMode: "normal"};
		if (options.rollMode === "dis") return options;
		return {...options, rollMode: "dis"};
	}

	applyRollMode(stat, rollMode) {
		return this.applyDebilityRollMode(stat, {rollMode}).rollMode;
	}
}
