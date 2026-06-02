import { describe, expect, it } from "vitest";
import { CharacterStats } from "../../../src/actors/character/CharacterStats.js";
import { Stats } from "../../../src/model/data/character/Stats.js";

function makeStatsActor(stats = {}) {
	return { system: { stats } };
}

// -- getStats ------------------------------------------------------------------

describe("CharacterStats.getStats", () => {
	it("returns a Stats instance", () => {
		expect(new CharacterStats(makeStatsActor()).getStats()).toBeInstanceOf(Stats);
	});

	it("named stat property reflects actor value", () => {
		const actor = makeStatsActor({ con: { value: 3 } });
		expect(new CharacterStats(actor).getStats().con).toBe(3);
	});

	it("get(key) reflects actor value", () => {
		const actor = makeStatsActor({ str: { value: -1 } });
		expect(new CharacterStats(actor).getStats().get("str")).toBe(-1);
	});

	it("defaults to 0 for missing stats", () => {
		expect(new CharacterStats(makeStatsActor()).getStats().wis).toBe(0);
	});
});

// -- buildStatsSnapshot --------------------------------------------------------

describe("CharacterStats.buildStatsSnapshot", () => {
	it("returns an entry for each of the 6 stats", () => {
		const snap = new CharacterStats(makeStatsActor()).buildStatsSnapshot();
		expect(Object.keys(snap)).toEqual(["str", "dex", "int", "wis", "con", "cha"]);
	});

	it("maps the value from actor system.stats", () => {
		const actor = makeStatsActor({ str: { value: 3 }, dex: { value: -1 } });
		const snap = new CharacterStats(actor).buildStatsSnapshot();
		expect(snap.str.value).toBe(3);
		expect(snap.dex.value).toBe(-1);
	});

	it("defaults to 0 when a stat is missing from the actor", () => {
		expect(new CharacterStats(makeStatsActor()).buildStatsSnapshot().wis.value).toBe(0);
	});
});
