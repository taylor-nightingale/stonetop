import { describe, expect, it } from "vitest";
import { CharacterDebilities } from "../../../src/actors/character/CharacterDebilities.js";
import { FakeActorBuilder } from "../../fakes/FakeActorBuilder.js";

// -- helpers -------------------------------------------------------------------

function makeDebilityActor({ weakened = false, dazed = false, miserable = false } = {}) {
	return new FakeActorBuilder()
		.withDebility("weakened", weakened)
		.withDebility("dazed", dazed)
		.withDebility("miserable", miserable)
		.build();
}

// -- setDebility ---------------------------------------------------------------

describe("CharacterDebilities.setDebility", () => {
	it("sets weakened to true", async () => {
		const actor = new FakeActorBuilder().build();
		await new CharacterDebilities(actor).setDebility("weakened", true);
		expect(actor.system.attributes.debilities.options.weakened.value).toBe(true);
	});

	it("sets weakened back to false", async () => {
		const actor = new FakeActorBuilder().build();
		const debilities = new CharacterDebilities(actor);
		await debilities.setDebility("weakened", true);
		await debilities.setDebility("weakened", false);
		expect(actor.system.attributes.debilities.options.weakened.value).toBe(false);
	});

	it("sets dazed independently of weakened", async () => {
		const actor = new FakeActorBuilder().build();
		await new CharacterDebilities(actor).setDebility("dazed", true);
		expect(actor.system.attributes.debilities.options.dazed.value).toBe(true);
		expect(actor.system.attributes.debilities.options.weakened.value).toBe(false);
	});

	it("sets miserable independently", async () => {
		const actor = new FakeActorBuilder().build();
		await new CharacterDebilities(actor).setDebility("miserable", true);
		expect(actor.system.attributes.debilities.options.miserable.value).toBe(true);
	});

	it("multiple debilities can be active simultaneously", async () => {
		const actor = new FakeActorBuilder().build();
		const debilities = new CharacterDebilities(actor);
		await debilities.setDebility("weakened", true);
		await debilities.setDebility("dazed", true);
		expect(actor.system.attributes.debilities.options.weakened.value).toBe(true);
		expect(actor.system.attributes.debilities.options.dazed.value).toBe(true);
	});
});

// -- buildDebilitiesSnapshot ---------------------------------------------------

describe("CharacterDebilities.buildDebilitiesSnapshot", () => {
	it("returns exactly 3 debilities", () => {
		expect(new CharacterDebilities(makeDebilityActor()).buildDebilitiesSnapshot()).toHaveLength(3);
	});

	it("marks a debility as active when its value is true on the actor", () => {
		const snap = new CharacterDebilities(makeDebilityActor({weakened: true})).buildDebilitiesSnapshot();
		expect(snap.find(d => d.key === "weakened").active).toBe(true);
		expect(snap.find(d => d.key === "dazed").active).toBe(false);
	});

	it("includes the correct stats array for each debility", () => {
		const snap = new CharacterDebilities(makeDebilityActor()).buildDebilitiesSnapshot();
		expect(snap.find(d => d.key === "weakened").stats).toEqual(["str", "dex"]);
		expect(snap.find(d => d.key === "dazed").stats).toEqual(["int", "wis"]);
		expect(snap.find(d => d.key === "miserable").stats).toEqual(["con", "cha"]);
	});
});

// -- applyDebilityRollMode -----------------------------------------------------

describe("CharacterDebilities.applyDebilityRollMode", () => {
	it("no debility active — passes rollMode through unchanged", () => {
		const debilities = new CharacterDebilities(makeDebilityActor());
		expect(debilities.applyDebilityRollMode("str", {rollMode: "normal"})).toEqual({rollMode: "normal"});
		expect(debilities.applyDebilityRollMode("str", {rollMode: "adv"})).toEqual({rollMode: "adv"});
	});

	it("debility active, stat affected, rollMode def → dis", () => {
		const debilities = new CharacterDebilities(makeDebilityActor({weakened: true}));
		expect(debilities.applyDebilityRollMode("str", {rollMode: "normal"})).toEqual({rollMode: "dis"});
	});

	it("debility active, stat affected, rollMode adv → def (cancel)", () => {
		const debilities = new CharacterDebilities(makeDebilityActor({weakened: true}));
		expect(debilities.applyDebilityRollMode("str", {rollMode: "adv"})).toEqual({rollMode: "normal"});
	});

	it("debility active, stat affected, rollMode dis → dis (unchanged)", () => {
		const debilities = new CharacterDebilities(makeDebilityActor({weakened: true}));
		expect(debilities.applyDebilityRollMode("str", {rollMode: "dis"})).toEqual({rollMode: "dis"});
	});

	it("debility active but for a different stat — passes through unchanged", () => {
		const debilities = new CharacterDebilities(makeDebilityActor({weakened: true}));
		expect(debilities.applyDebilityRollMode("int", {rollMode: "normal"})).toEqual({rollMode: "normal"});
	});

	it("dazed covers int and wis, rollMode def → dis", () => {
		const debilities = new CharacterDebilities(makeDebilityActor({dazed: true}));
		expect(debilities.applyDebilityRollMode("int", {rollMode: "normal"})).toEqual({rollMode: "dis"});
		expect(debilities.applyDebilityRollMode("wis", {rollMode: "normal"})).toEqual({rollMode: "dis"});
	});

	it("preserves other options fields while changing rollMode", () => {
		const debilities = new CharacterDebilities(makeDebilityActor({weakened: true}));
		expect(debilities.applyDebilityRollMode("str", {rollMode: "adv", extra: "value"}))
			.toEqual({rollMode: "normal", extra: "value"});
	});
});

// -- applyRollMode -------------------------------------------------------------

describe("CharacterDebilities.applyRollMode", () => {
	it("returns rollMode unchanged when no debility is active", () => {
		const debilities = new CharacterDebilities(makeDebilityActor());
		expect(debilities.applyRollMode("str", "normal")).toBe("normal");
		expect(debilities.applyRollMode("str", "adv")).toBe("adv");
	});

	it("returns 'dis' when relevant debility is active and rollMode is 'def'", () => {
		const debilities = new CharacterDebilities(makeDebilityActor({weakened: true}));
		expect(debilities.applyRollMode("str", "normal")).toBe("dis");
	});

	it("returns 'def' when relevant debility cancels advantage", () => {
		const debilities = new CharacterDebilities(makeDebilityActor({weakened: true}));
		expect(debilities.applyRollMode("str", "adv")).toBe("normal");
	});

	it("returns 'dis' when debility is active and rollMode is already 'dis'", () => {
		const debilities = new CharacterDebilities(makeDebilityActor({weakened: true}));
		expect(debilities.applyRollMode("str", "dis")).toBe("dis");
	});

	it("passes through unchanged when debility covers a different stat", () => {
		const debilities = new CharacterDebilities(makeDebilityActor({weakened: true}));
		expect(debilities.applyRollMode("wis", "normal")).toBe("normal");
	});
});
