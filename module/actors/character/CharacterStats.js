import { StatSnapshot, DebilitySnapshotBuilder } from "../../model/snapshot/character/CharacterSnapshot.js";
import { Stats } from "../../model/data/character/Stats.js";

const _STAT_DEFS = {
	str: { name: "Strength",     abbr: "STR" },
	dex: { name: "Dexterity",    abbr: "DEX" },
	con: { name: "Constitution", abbr: "CON" },
	int: { name: "Intelligence", abbr: "INT" },
	wis: { name: "Wisdom",       abbr: "WIS" },
	cha: { name: "Charisma",     abbr: "CHA" },
};

const _DEBILITY_DEFS = [
	{ key: "weakened",  name: "Weakened",  stats: ["str", "dex"] },
	{ key: "dazed",     name: "Dazed",     stats: ["int", "wis"] },
	{ key: "miserable", name: "Miserable", stats: ["con", "cha"] },
];

export class CharacterStats {
	constructor(actor) {
		this._actor = actor;
	}

	getStats() {
		const raw = this._actor.system?.stats ?? {};
		return new Stats(Object.fromEntries(Object.keys(_STAT_DEFS).map(k => [k, raw[k]?.value ?? 0])));
	}

	buildStatsSnapshot() {
		const stats = this.getStats();
		return Object.fromEntries(
			Object.entries(_STAT_DEFS).map(([key, { name, abbr }]) => [
				key,
				new StatSnapshot(stats.get(key), name, abbr),
			])
		);
	}

	buildDebilitiesSnapshot() {
		const opts = this._actor.system?.attributes?.debilities?.options ?? {};
		return _DEBILITY_DEFS.map(({ key, name, stats }) =>
			new DebilitySnapshotBuilder()
				.withKey(key)
				.withName(name)
				.withActive(!!(opts[key]?.value))
				.withStats(stats)
				.build()
		);
	}

	applyDebilityRollMode(stat, options) {
		const debilityOptions = this._actor.system.attributes?.debilities?.options ?? {};
		const hasActiveDebility = Object.values(debilityOptions).some(
			opt => opt.value && Array.isArray(opt.stat) && opt.stat.includes(stat)
		);
		if (!hasActiveDebility) return options;
		if (options.rollMode === "adv") return { ...options, rollMode: "def" };
		if (options.rollMode === "dis") return options;
		return { ...options, rollMode: "dis" };
	}

	async onRoll(event) {
		const itemId = event.currentTarget.closest(".item")?.dataset.itemId;
		if (!itemId) return false;
		const item = this._actor.items.get(itemId);
		const stat = item?.system?.rollType ?? null;
		if (!stat) return false;

		const isDescription = event.currentTarget.getAttribute("data-show") === "description";
		const descriptionOnly = isDescription || (item.type === "npcMove" && !item.system.rollFormula);
		const options = {};
		if (!game.settings.get("pbta", "hideRollMode")) {
			options.rollMode = this._actor.flags?.pbta?.rollMode;
		}
		await item.roll({ ...this.applyDebilityRollMode(stat, options), descriptionOnly });
		return true;
	}
}
