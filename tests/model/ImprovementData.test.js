import { describe, it, expect } from "vitest";
import { ImprovementData } from "../../src/data/ImprovementData.js";

describe("ImprovementData defaults", () => {
	it("defaults slug to null", () => {
		expect(new ImprovementData().slug).toBeNull();
	});

	it("defaults sortOrder to null", () => {
		expect(new ImprovementData().sortOrder).toBeNull();
	});

	it("defaults choices to null", () => {
		expect(new ImprovementData().choices).toBeNull();
	});
});

// A result's schema is what the pack's authored fields have to survive: a key the schema does not
// name is dropped on the way in, silently, and the sheet then renders a result that has lost the one
// thing telling it where to go.
describe("what a result keeps", () => {
	const first = raw => new ImprovementData({ effects: [raw] }).effects[0];

	it("keeps the tier a result waits on", () => {
		expect(first({ text: "generates 1 Surplus", outcome: "7+" }).outcome).toBe("7+");
		expect(first({ text: "t" }).outcome).toBe("");
	});

	// Where in the step a bend hooks travels inside the adjustment, which is a free-form bag.
	it("keeps where a bend hooks", () => {
		expect(first({ text: "t", adjustment: { step: "consumption", at: "formula", die: "2d6" } })
			.adjustment).toEqual({ step: "consumption", at: "formula", die: "2d6" });
	});
});
