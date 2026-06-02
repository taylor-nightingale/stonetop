import { StatSnapshot } from "../../model/snapshot/character/CharacterSnapshot.js";
import { Stats } from "../../model/data/character/Stats.js";

const _STAT_DEFS = {
	str: { name: "Strength",     abbr: "STR" },
	dex: { name: "Dexterity",    abbr: "DEX" },
	int: { name: "Intelligence", abbr: "INT" },
	wis: { name: "Wisdom",       abbr: "WIS" },
	con: { name: "Constitution", abbr: "CON" },
	cha: { name: "Charisma",     abbr: "CHA" },
};

export class CharacterStats {
	constructor(actor) {
		this._actor = actor;
	}

	getStats() {
		const raw = this._actor.system?.stats ?? {};
		return new Stats(Object.fromEntries(Object.keys(_STAT_DEFS).map(k => [k, raw[k]?.value ?? 0])));
	}

	getRollableStats() {
		const stats = this.getStats();
		return Object.entries(_STAT_DEFS).map(([key, { name }]) => ({ key, name, value: stats.get(key) }));
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
}
