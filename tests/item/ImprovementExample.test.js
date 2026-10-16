import { describe, it, expect } from "vitest";
import { ImprovementExample } from "../../src/item/ImprovementExample.js";

const E = "stonetop.improvement.example";
function i18n(strings) {
	return {
		has:      key => typeof strings[key] === "string",
		localize: key => strings[key] ?? key,
	};
}
const FULL = {
	[`${E}.name`]: "Example Improvement",
	[`${E}.line`]: "An improvement would make all our lives better.",
	[`${E}.heading`]: "Requires all of the following:",
	[`${E}.requirementOne`]: "Pen and paper",
	[`${E}.requirementTwo`]: "Creativity and community to write it!",
	[`${E}.completion`]: "increase Fortunes by 1",
	[`${E}.henceforth`]: "you are extra happy",
};

describe("ImprovementExample", () => {
	it("writes the example improvement a new one starts as", () => {
		const system = new ImprovementExample(i18n(FULL)).system("custom-improvement-x");
		expect(system.slug).toBe("custom-improvement-x");
		expect(system.choices.slug).toBe("custom-improvement-x");
		expect(system.choices.list.map(r => [r.content.text, r.track?.max ?? 0])).toEqual([
			["An improvement would make all our lives better.", 0],
			["Requires all of the following:", 0],
			["Pen and paper", 1],
			["Creativity and community to write it!", 1],
		]);
		expect(system.requires).toEqual({ all: ["entry-0", "entry-1"] });
		expect(system.effects).toEqual([
			{ when: { kind: "completed" }, change: { target: "fortunes", amount: 1 }, text: "increase Fortunes by 1" },
			{ when: { kind: "turn", seasons: ["spring"] }, text: "you are extra happy" },
		]);
	});

	it("names it", () => {
		expect(new ImprovementExample(i18n(FULL)).name).toBe("Example Improvement");
	});

	// A result with no words would still DO something — +1 Fortunes nobody can see. So a line whose
	// words are not written yet is left out, and its mechanic with it.
	it("leaves out every line and result whose words are not written", () => {
		const system = new ImprovementExample(i18n({ ...FULL, [`${E}.completion`]: "", [`${E}.line`]: "" })).system("s");
		expect(system.choices.list.map(r => r.content.text)).toEqual(["Requires all of the following:", "Pen and paper", "Creativity and community to write it!"]);
		expect(system.effects.map(e => e.text)).toEqual(["you are extra happy"]);
	});

	it("starts empty when none of the example is written", () => {
		const system = new ImprovementExample(i18n({})).system("s");
		expect(system).toEqual({ slug: "s", choices: { slug: "s", list: [] }, requires: { all: [] }, effects: [] });
		expect(new ImprovementExample(i18n({})).name).toBeNull();
	});
});
