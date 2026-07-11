import { describe, expect, it } from "vitest";
import { CharacterStats } from "../../../src/actors/character/CharacterStats.js";
import { Stats } from "../../../src/model/data/character/Stats.js";
import { FakeCharacterActorBuilder, FakeStatBuilder } from "../../fakes/FakeCharacterActorBuilder.js";

// -- getStats ------------------------------------------------------------------

describe("CharacterStats.getStats", () => {
	it("returns a Stats instance", () => {
		expect(new CharacterStats(new FakeCharacterActorBuilder().build()).getStats()).toBeInstanceOf(Stats);
	});

	it("named stat property reflects actor value", () => {
		const actor = new FakeCharacterActorBuilder().withStats(new FakeStatBuilder().withCon(3)).build();
		expect(new CharacterStats(actor).getStats().con).toBe(3);
	});

	it("get(key) reflects actor value", () => {
		const actor = new FakeCharacterActorBuilder().withStats(new FakeStatBuilder().withStr(-1)).build();
		expect(new CharacterStats(actor).getStats().get("str")).toBe(-1);
	});

	it("defaults to 0 for missing stats", () => {
		expect(new CharacterStats(new FakeCharacterActorBuilder().build()).getStats().wis).toBe(0);
	});
});

// -- getRollableStats ----------------------------------------------------------

describe("CharacterStats.getRollableStats", () => {
	it("returns 6 entries, one per stat", () => {
		expect(new CharacterStats(new FakeCharacterActorBuilder().build()).getRollableStats()).toHaveLength(6);
	});

	it("each entry has key, name, and value", () => {
		const actor = new FakeCharacterActorBuilder().withStats(new FakeStatBuilder().withWis(2)).build();
		const stats = new CharacterStats(actor).getRollableStats();
		const wis = stats.find(s => s.key === "wis");
		expect(wis).toBeDefined();
		expect(wis.name).toBe("Wisdom");
		expect(wis.value).toBe(2);
	});

	it("covers all six stat keys", () => {
		const keys = new CharacterStats(new FakeCharacterActorBuilder().build()).getRollableStats().map(s => s.key);
		expect(keys).toEqual(expect.arrayContaining(["str", "dex", "con", "int", "wis", "cha"]));
	});

	it("defaults to 0 for missing stat values", () => {
		const stats = new CharacterStats(new FakeCharacterActorBuilder().build()).getRollableStats();
		expect(stats.every(s => s.value === 0)).toBe(true);
	});
});

// -- resolveBonus --------------------------------------------------------------

describe("CharacterStats.resolveBonus", () => {
	it("returns the stat value for a known stat key", () => {
		const actor = new FakeCharacterActorBuilder().withStats(new FakeStatBuilder().withWis(2)).build();
		expect(new CharacterStats(actor).resolveBonus("wis")).toBe(2);
	});

	it("returns 0 for a known stat with no value set", () => {
		expect(new CharacterStats(new FakeCharacterActorBuilder().build()).resolveBonus("str")).toBe(0);
	});

	it("returns null for an unknown stat key", () => {
		expect(new CharacterStats(new FakeCharacterActorBuilder().build()).resolveBonus("loyalty")).toBeNull();
	});
});

// -- buildStatsSnapshot --------------------------------------------------------

describe("CharacterStats.buildStatsSnapshot", () => {
	it("returns an entry for each of the 6 stats", () => {
		const snap = new CharacterStats(new FakeCharacterActorBuilder().build()).buildStatsSnapshot();
		expect(Object.keys(snap)).toEqual(["str", "dex", "int", "wis", "con", "cha"]);
	});

	it("maps the value from actor system.stats", () => {
		const actor = new FakeCharacterActorBuilder().withStats(new FakeStatBuilder().withStr(3).withDex(-1)).build();
		const snap = new CharacterStats(actor).buildStatsSnapshot();
		expect(snap.str.value).toBe(3);
		expect(snap.dex.value).toBe(-1);
	});

	it("defaults to 0 when a stat is missing from the actor", () => {
		expect(new CharacterStats(new FakeCharacterActorBuilder().build()).buildStatsSnapshot().wis.value).toBe(0);
	});

	it("carries a description for every stat (localization key when no i18n)", () => {
		const snap = new CharacterStats(new FakeCharacterActorBuilder().build()).buildStatsSnapshot();
		for (const key of ["str", "dex", "int", "wis", "con", "cha"]) {
			expect(snap[key].description).toBe(`stonetop.character.stats.desc.${key}`);
		}
	});

	it("localizes the description through game.i18n when available", () => {
		const prev = globalThis.game;
		globalThis.game = { i18n: { localize: (k) => (k === "stonetop.character.stats.desc.str" ? "Your physical power" : k) } };
		try {
			const snap = new CharacterStats(new FakeCharacterActorBuilder().build()).buildStatsSnapshot();
			expect(snap.str.description).toBe("Your physical power");
		} finally {
			globalThis.game = prev;
		}
	});
});
