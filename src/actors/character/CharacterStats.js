import { StatSnapshot } from "../../model/snapshot/character/CharacterSnapshot.js";
import { Stats } from "../../model/data/character/Stats.js";

/* Keys, never words. The name and the abbreviation used to be written here in English, so a German
   sheet drew "STR"/"Strength" beside a fully translated band — and the translations existed the
   whole time, unused, because the defs table answered first.

   The order is the book's (str dex int wis con cha) — the order the tiles are drawn in — and
   deliberately not `STAT_KEYS`', which is the storage order. Same six either way; that they stay the
   same six is what CharacterStats.test.js asserts, through the snapshot rather than through a second
   exported copy of the list. */
const _STAT_DEFS = {
	str: { nameKey: "stonetop.character.stats.strength",     abbrKey: "stonetop.character.stats.abbr.str", descKey: "stonetop.character.stats.desc.str" },
	dex: { nameKey: "stonetop.character.stats.dexterity",    abbrKey: "stonetop.character.stats.abbr.dex", descKey: "stonetop.character.stats.desc.dex" },
	int: { nameKey: "stonetop.character.stats.intelligence", abbrKey: "stonetop.character.stats.abbr.int", descKey: "stonetop.character.stats.desc.int" },
	wis: { nameKey: "stonetop.character.stats.wisdom",       abbrKey: "stonetop.character.stats.abbr.wis", descKey: "stonetop.character.stats.desc.wis" },
	con: { nameKey: "stonetop.character.stats.constitution", abbrKey: "stonetop.character.stats.abbr.con", descKey: "stonetop.character.stats.desc.con" },
	cha: { nameKey: "stonetop.character.stats.charisma",     abbrKey: "stonetop.character.stats.abbr.cha", descKey: "stonetop.character.stats.desc.cha" },
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
		return Object.entries(_STAT_DEFS).map(([key, { nameKey }]) =>
			({ key, name: _localize(nameKey), value: stats.get(key) }));
	}

	resolveBonus(stat) {
		const stats = this.getStats();
		return stat in stats ? stats.get(stat) : null;
	}

	buildStatsSnapshot() {
		const stats = this.getStats();
		return Object.fromEntries(
			Object.entries(_STAT_DEFS).map(([key, { nameKey, abbrKey, descKey }]) => [
				key,
				new StatSnapshot(key, stats.get(key), _localize(nameKey), _localize(abbrKey), _localize(descKey)),
			])
		);
	}
}
