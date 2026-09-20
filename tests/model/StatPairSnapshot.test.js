import { describe, it, expect } from "vitest";
import { StatPairSnapshot } from "../../src/model/snapshot/character/StatPairSnapshot.js";
import { StatSnapshot } from "../../src/model/snapshot/character/StatSnapshot.js";
import { DebilitySnapshotBuilder } from "../../src/model/snapshot/character/DebilitySnapshot.js";

const stat = (key, value, name, abbr) => new StatSnapshot(key, value, name, abbr, `${name} description`);

const debility = (key, stats, active = false) => new DebilitySnapshotBuilder()
	.withKey(key).withName(key).withActive(active).withStats(stats)
	.withDescription(`${key} description`).build();

/** The six, as CharacterStats#buildStatsSnapshot hands them over: keyed, not a list. */
const STATS = {
	str: stat("str", 1, "Strength", "STR"),
	dex: stat("dex", 1, "Dexterity", "DEX"),
	int: stat("int", 2, "Intelligence", "INT"),
	wis: stat("wis", 0, "Wisdom", "WIS"),
	con: stat("con", 0, "Constitution", "CON"),
	cha: stat("cha", -1, "Charisma", "CHA"),
};

const DEBILITIES = [
	debility("weakened",  ["str", "dex"]),
	debility("dazed",     ["int", "wis"], true),
	debility("miserable", ["con", "cha"]),
];

describe("StatPairSnapshot", () => {
	it("pairs each debility with the stats it names", () => {
		const pairs = StatPairSnapshot.pairsFrom(DEBILITIES, STATS);

		expect(pairs).toHaveLength(3);
		expect(pairs.map(p => p.debility.key)).toEqual(["weakened", "dazed", "miserable"]);
		expect(pairs.map(p => p.stats.map(s => s.key))).toEqual([
			["str", "dex"], ["int", "wis"], ["con", "cha"],
		]);
	});

	it("keeps the debility's own order, so the row reads the way the rules name it", () => {
		const [weakened] = StatPairSnapshot.pairsFrom([debility("weakened", ["dex", "str"])], STATS);
		expect(weakened.stats.map(s => s.key)).toEqual(["dex", "str"]);
	});

	it("carries the whole stat, not just its key — the tile needs the value and the name", () => {
		const [, dazed] = StatPairSnapshot.pairsFrom(DEBILITIES, STATS);
		expect(dazed.stats[0]).toMatchObject({ key: "int", value: 2, name: "Intelligence", abbr: "INT" });
	});

	it("carries the debility's active state, which is what the row draws its tick from", () => {
		const [weakened, dazed] = StatPairSnapshot.pairsFrom(DEBILITIES, STATS);
		expect(weakened.debility.active).toBe(false);
		expect(dazed.debility.active).toBe(true);
	});

	// The three pairs cover all six stats exactly once — that is what lets the rail draw every stat
	// in a 2×3 grid of pairs and know nothing has been left out.
	it("covers every stat exactly once across the three pairs", () => {
		const seen = StatPairSnapshot.pairsFrom(DEBILITIES, STATS).flatMap(p => p.stats.map(s => s.key));
		expect(seen.slice().sort()).toEqual(Object.keys(STATS).slice().sort());
	});

	// A debility naming a stat the sheet does not have would otherwise put `undefined` in the row and
	// blow up in the template rather than here.
	it("drops a stat it cannot resolve rather than passing a hole to the template", () => {
		const [pair] = StatPairSnapshot.pairsFrom([debility("odd", ["str", "nope"])], STATS);
		expect(pair.stats.map(s => s.key)).toEqual(["str"]);
	});

	it("returns nothing when there are no debilities", () => {
		expect(StatPairSnapshot.pairsFrom([], STATS)).toEqual([]);
	});
});
