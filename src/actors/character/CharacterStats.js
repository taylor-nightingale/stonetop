import { StatSnapshot } from "../../model/snapshot/character/CharacterSnapshot.js";
import { Stats } from "../../model/data/character/Stats.js";

const _STAT_DEFS = {
	str: { name: "Strength",     abbr: "STR", descKey: "stonetop.character.stats.desc.str" },
	dex: { name: "Dexterity",    abbr: "DEX", descKey: "stonetop.character.stats.desc.dex" },
	int: { name: "Intelligence", abbr: "INT", descKey: "stonetop.character.stats.desc.int" },
	wis: { name: "Wisdom",       abbr: "WIS", descKey: "stonetop.character.stats.desc.wis" },
	con: { name: "Constitution", abbr: "CON", descKey: "stonetop.character.stats.desc.con" },
	cha: { name: "Charisma",     abbr: "CHA", descKey: "stonetop.character.stats.desc.cha" },
};

const _localize = (key) => globalThis.game?.i18n?.localize?.(key) ?? key;

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

	resolveBonus(stat) {
		const stats = this.getStats();
		return stat in stats ? stats.get(stat) : null;
	}

	buildStatsSnapshot() {
		const stats = this.getStats();
		return Object.fromEntries(
			Object.entries(_STAT_DEFS).map(([key, { name, abbr, descKey }]) => [
				key,
				new StatSnapshot(stats.get(key), name, abbr, _localize(descKey)),
			])
		);
	}
}
