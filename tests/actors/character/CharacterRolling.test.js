import { afterEach, describe, expect, it, vi } from "vitest";
import { CharacterRolling } from "../../../src/actors/character/CharacterRolling.js";
import { CharacterStats } from "../../../src/actors/character/CharacterStats.js";
import { FakeActorBuilder, FakeStatBuilder } from "../../fakes/FakeActorBuilder.js";

// -- Helpers -------------------------------------------------------------------

function makeDebilityActor({ weakened = false, dazed = false, miserable = false, rollMode = "def" } = {}) {
	return new FakeActorBuilder()
		.withDebility("weakened", weakened)
		.withDebility("dazed", dazed)
		.withDebility("miserable", miserable)
		.withRollMode(rollMode)
		.build();
}

function makeRolling(actor, statsOverride = {}) {
	const stats = new CharacterStats({ system: { stats: statsOverride } });
	return new CharacterRolling(actor, stats);
}

function makeRollingWithActor(actor) {
	return new CharacterRolling(actor, new CharacterStats(actor));
}

// -- rollMode ------------------------------------------------------------------

describe("CharacterRolling.rollMode", () => {
	it("returns stored flag value", () => {
		const actor = makeDebilityActor({ rollMode: "adv" });
		expect(new CharacterRolling(actor, null).rollMode).toBe("adv");
	});

	it("defaults to 'normal' when flag not set", () => {
		const actor = new FakeActorBuilder().build();
		expect(new CharacterRolling(actor, null).rollMode).toBe("normal");
	});

	it("setRollMode writes flag and updates rollMode", async () => {
		const actor = makeDebilityActor();
		const rolling = new CharacterRolling(actor, null);
		await rolling.setRollMode("adv");
		expect(rolling.rollMode).toBe("adv");
	});
});

// -- buildDebilitiesSnapshot ---------------------------------------------------

describe("CharacterRolling.buildDebilitiesSnapshot", () => {
	it("returns exactly 3 debilities", () => {
		expect(makeRolling(makeDebilityActor()).buildDebilitiesSnapshot()).toHaveLength(3);
	});

	it("marks a debility as active when its value is true on the actor", () => {
		const snap = makeRolling(makeDebilityActor({ weakened: true })).buildDebilitiesSnapshot();
		expect(snap.find(d => d.key === "weakened").active).toBe(true);
		expect(snap.find(d => d.key === "dazed").active).toBe(false);
	});

	it("includes the correct stats array for each debility", () => {
		const snap = makeRolling(makeDebilityActor()).buildDebilitiesSnapshot();
		expect(snap.find(d => d.key === "weakened").stats).toEqual(["str", "dex"]);
		expect(snap.find(d => d.key === "dazed").stats).toEqual(["int", "wis"]);
		expect(snap.find(d => d.key === "miserable").stats).toEqual(["con", "cha"]);
	});
});

// -- applyDebilityRollMode -----------------------------------------------------

describe("CharacterRolling.applyDebilityRollMode", () => {
	it("no debility active — passes rollMode through unchanged", () => {
		const rolling = makeRolling(makeDebilityActor());
		expect(rolling.applyDebilityRollMode("str", { rollMode: "def" })).toEqual({ rollMode: "def" });
		expect(rolling.applyDebilityRollMode("str", { rollMode: "adv" })).toEqual({ rollMode: "adv" });
	});

	it("debility active, stat affected, rollMode def → dis", () => {
		const rolling = makeRolling(makeDebilityActor({ weakened: true }));
		expect(rolling.applyDebilityRollMode("str", { rollMode: "def" })).toEqual({ rollMode: "dis" });
	});

	it("debility active, stat affected, rollMode adv → def (cancel)", () => {
		const rolling = makeRolling(makeDebilityActor({ weakened: true }));
		expect(rolling.applyDebilityRollMode("str", { rollMode: "adv" })).toEqual({ rollMode: "def" });
	});

	it("debility active, stat affected, rollMode dis → dis (unchanged)", () => {
		const rolling = makeRolling(makeDebilityActor({ weakened: true }));
		expect(rolling.applyDebilityRollMode("str", { rollMode: "dis" })).toEqual({ rollMode: "dis" });
	});

	it("debility active but for a different stat — passes through unchanged", () => {
		const rolling = makeRolling(makeDebilityActor({ weakened: true }));
		expect(rolling.applyDebilityRollMode("int", { rollMode: "def" })).toEqual({ rollMode: "def" });
	});

	it("dazed covers int and wis, rollMode def → dis", () => {
		const rolling = makeRolling(makeDebilityActor({ dazed: true }));
		expect(rolling.applyDebilityRollMode("int", { rollMode: "def" })).toEqual({ rollMode: "dis" });
		expect(rolling.applyDebilityRollMode("wis", { rollMode: "def" })).toEqual({ rollMode: "dis" });
	});

	it("preserves other options fields while changing rollMode", () => {
		const rolling = makeRolling(makeDebilityActor({ weakened: true }));
		expect(rolling.applyDebilityRollMode("str", { rollMode: "adv", extra: "value" }))
			.toEqual({ rollMode: "def", extra: "value" });
	});
});

// -- getRollableStats ----------------------------------------------------------

describe("CharacterRolling.getRollableStats", () => {
	it("returns 6 entries", () => {
		const actor = new FakeActorBuilder().build();
		expect(makeRollingWithActor(actor).getRollableStats()).toHaveLength(6);
	});

	it("each entry has key, name, and value", () => {
		const actor = new FakeActorBuilder().withStats(new FakeStatBuilder().withWis(2)).build();
		const stats = makeRollingWithActor(actor).getRollableStats();
		const wis = stats.find(s => s.key === "wis");
		expect(wis).toBeDefined();
		expect(wis.name).toBe("Wisdom");
		expect(wis.value).toBe(2);
	});

	it("covers all six stat keys", () => {
		const actor = new FakeActorBuilder().build();
		const keys = makeRollingWithActor(actor).getRollableStats().map(s => s.key);
		expect(keys).toEqual(expect.arrayContaining(["str", "dex", "con", "int", "wis", "cha"]));
	});
});

// -- resolveBonus --------------------------------------------------------------

describe("CharacterRolling.resolveBonus", () => {
	it("returns the stat value for a known stat key", () => {
		const actor = new FakeActorBuilder().withStats(new FakeStatBuilder().withWis(2)).build();
		expect(makeRollingWithActor(actor).resolveBonus("wis")).toBe(2);
	});

	it("returns 0 for a known stat with no value set", () => {
		const actor = new FakeActorBuilder().build();
		expect(makeRollingWithActor(actor).resolveBonus("str")).toBe(0);
	});

	it("returns null for an unknown rollStat key", () => {
		const actor = new FakeActorBuilder().build();
		expect(makeRollingWithActor(actor).resolveBonus("loyalty")).toBeNull();
	});
});

// -- applyRollMode -------------------------------------------------------------

describe("CharacterRolling.applyRollMode", () => {
	it("returns rollMode unchanged when no debility is active", () => {
		const rolling = makeRolling(makeDebilityActor());
		expect(rolling.applyRollMode("str", "def")).toBe("def");
		expect(rolling.applyRollMode("str", "adv")).toBe("adv");
	});

	it("returns 'dis' when relevant debility is active and rollMode is 'def'", () => {
		const rolling = makeRolling(makeDebilityActor({ weakened: true }));
		expect(rolling.applyRollMode("str", "def")).toBe("dis");
	});

	it("returns 'def' when relevant debility cancels advantage", () => {
		const rolling = makeRolling(makeDebilityActor({ weakened: true }));
		expect(rolling.applyRollMode("str", "adv")).toBe("def");
	});

	it("returns 'dis' when debility is active and rollMode is already 'dis'", () => {
		const rolling = makeRolling(makeDebilityActor({ weakened: true }));
		expect(rolling.applyRollMode("str", "dis")).toBe("dis");
	});

	it("passes through unchanged when debility covers a different stat", () => {
		const rolling = makeRolling(makeDebilityActor({ weakened: true }));
		expect(rolling.applyRollMode("wis", "def")).toBe("def");
	});
});

// -- rollStat("damage") --------------------------------------------------------

describe("CharacterRolling.rollStat — damage", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("is a no-op when actor has no damage die value", async () => {
		const actor = new FakeActorBuilder().build();
		const rolling = new CharacterRolling(actor, new CharacterStats(actor));
		await expect(rolling.rollStat("damage")).resolves.toBeUndefined();
	});
});
