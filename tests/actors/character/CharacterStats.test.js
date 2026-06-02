import { describe, expect, it } from "vitest";
import { CharacterStats } from "../../../src/actors/character/CharacterStats.js";
import { Stats } from "../../../src/model/data/character/Stats.js";
import { FakeActorBuilder, FakeStatBuilder } from "../../fakes/FakeActorBuilder.js";

// -- getStats ------------------------------------------------------------------

describe("CharacterStats.getStats", () => {
	it("returns a Stats instance", () => {
		expect(new CharacterStats(new FakeActorBuilder().build()).getStats()).toBeInstanceOf(Stats);
	});

	it("named stat property reflects actor value", () => {
		const actor = new FakeActorBuilder().withStats(new FakeStatBuilder().withCon(3)).build();
		expect(new CharacterStats(actor).getStats().con).toBe(3);
	});

	it("get(key) reflects actor value", () => {
		const actor = new FakeActorBuilder().withStats(new FakeStatBuilder().withStr(-1)).build();
		expect(new CharacterStats(actor).getStats().get("str")).toBe(-1);
	});

	it("defaults to 0 for missing stats", () => {
		expect(new CharacterStats(new FakeActorBuilder().build()).getStats().wis).toBe(0);
	});
});

// -- getRollableStats ----------------------------------------------------------

describe("CharacterStats.getRollableStats", () => {
	it("returns 6 entries, one per stat", () => {
		expect(new CharacterStats(new FakeActorBuilder().build()).getRollableStats()).toHaveLength(6);
	});

	it("each entry has key, name, and value", () => {
		const actor = new FakeActorBuilder().withStats(new FakeStatBuilder().withWis(2)).build();
		const stats = new CharacterStats(actor).getRollableStats();
		const wis = stats.find(s => s.key === "wis");
		expect(wis).toBeDefined();
		expect(wis.name).toBe("Wisdom");
		expect(wis.value).toBe(2);
	});

	it("covers all six stat keys", () => {
		const keys = new CharacterStats(new FakeActorBuilder().build()).getRollableStats().map(s => s.key);
		expect(keys).toEqual(expect.arrayContaining(["str", "dex", "con", "int", "wis", "cha"]));
	});

	it("defaults to 0 for missing stat values", () => {
		const stats = new CharacterStats(new FakeActorBuilder().build()).getRollableStats();
		expect(stats.every(s => s.value === 0)).toBe(true);
	});
});

// -- buildStatsSnapshot --------------------------------------------------------

describe("CharacterStats.buildStatsSnapshot", () => {
	it("returns an entry for each of the 6 stats", () => {
		const snap = new CharacterStats(new FakeActorBuilder().build()).buildStatsSnapshot();
		expect(Object.keys(snap)).toEqual(["str", "dex", "int", "wis", "con", "cha"]);
	});

	it("maps the value from actor system.stats", () => {
		const actor = new FakeActorBuilder().withStats(new FakeStatBuilder().withStr(3).withDex(-1)).build();
		const snap = new CharacterStats(actor).buildStatsSnapshot();
		expect(snap.str.value).toBe(3);
		expect(snap.dex.value).toBe(-1);
	});

	it("defaults to 0 when a stat is missing from the actor", () => {
		expect(new CharacterStats(new FakeActorBuilder().build()).buildStatsSnapshot().wis.value).toBe(0);
	});
});
