import { describe, it, expect } from "vitest";
import { SteadingRolls } from "../../../src/actors/steading/SteadingRolls.js";
import { SteadingDebilities } from "../../../src/actors/steading/SteadingDebilities.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";

function build(attributes = {}, debilities = {}) {
	const actor = new FakeSteadingBuilder().build();
	Object.assign(actor.system.attributes, attributes);
	Object.assign(actor.system.debilities, debilities);
	return { actor, rolls: new SteadingRolls(actor, new SteadingDebilities(actor)) };
}

describe("SteadingRolls.resolveBonus", () => {
	it("reads the stored rating", () => {
		expect(build({ population: 2 }).rolls.resolveBonus("population")).toBe(2);
	});

	// Null keeps "no such rating" distinct from a rating sitting at 0.
	it("is null for a rating the steading does not have", () => {
		expect(build().rolls.resolveBonus("charisma")).toBeNull();
	});

	it("is 0, not null, for a rating stored at zero", () => {
		expect(build({ defenses: 0 }).rolls.resolveBonus("defenses")).toBe(0);
	});

	// Lacking is the one debility that bends a number rather than the roll.
	it("costs Prosperity one while Lacking", () => {
		expect(build({ prosperity: 2 }, { lacking: true }).rolls.resolveBonus("prosperity")).toBe(1);
	});

	it("leaves every other rating alone while Lacking", () => {
		expect(build({ defenses: 2 }, { lacking: true }).rolls.resolveBonus("defenses")).toBe(2);
	});
});

describe("SteadingRolls.prosperity", () => {
	it("is the resolved rating, Lacking included", () => {
		expect(build({ prosperity: 1 }, { lacking: true }).rolls.prosperity).toBe(0);
	});

	it("falls back to 0 when there is no rating at all", () => {
		const { actor, rolls } = build();
		delete actor.system.attributes.prosperity;
		expect(rolls.prosperity).toBe(0);
	});
});

describe("SteadingRolls.rollableStats", () => {
	it("offers the four rollable ratings with their resolved values", () => {
		const { rolls } = build({ population: 1, prosperity: 2, defenses: -1, fortunes: 3 });
		expect(rolls.rollableStats()).toEqual([
			{ key: "population", name: "Population", value: 1 },
			{ key: "prosperity", name: "Prosperity", value: 2 },
			{ key: "defenses",   name: "Defenses",   value: -1 },
			{ key: "fortunes",   name: "Fortunes",   value: 3 },
		]);
	});

	it("resolves Lacking into the offered Prosperity", () => {
		const { rolls } = build({ prosperity: 2 }, { lacking: true });
		expect(rolls.rollableStats().find(s => s.key === "prosperity").value).toBe(1);
	});
});

// Diminished is the debility that hinders moves — Deploy, Muster and Pull Together.
describe("SteadingRolls.applyRollMode", () => {
	it("leaves the mode alone when nothing is marked", () => {
		expect(build().rolls.applyRollMode("population", "normal", "muster")).toBe("normal");
	});

	it("hinders a move the marked debility names", () => {
		const { rolls } = build({}, { diminished: true });
		expect(rolls.applyRollMode("population", "normal", "muster")).toBe("dis");
	});

	it("leaves a move the debility does not name alone", () => {
		const { rolls } = build({}, { diminished: true });
		expect(rolls.applyRollMode("population", "normal", "bolster")).toBe("normal");
	});

	// A bare rating roll carries no move, so there is nothing for a debility to match.
	it("leaves a roll with no move behind it alone", () => {
		const { rolls } = build({}, { diminished: true });
		expect(rolls.applyRollMode("population", "normal", null)).toBe("normal");
	});

	// Advantage cancels to normal rather than falling straight to disadvantage.
	it("cancels advantage rather than overriding it", () => {
		const { rolls } = build({}, { diminished: true });
		expect(rolls.applyRollMode("population", "adv", "muster")).toBe("normal");
	});
});
