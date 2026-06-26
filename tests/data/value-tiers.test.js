import { describe, it, expect } from "vitest";
import { valueTooltip, VALUE_TIER_WORTH } from "../../module/data/value-tiers.js";

describe("valueTooltip", () => {
	it("describes each named tier 0-4 with its worth and the non-linear note", () => {
		for (const tier of [0, 1, 2, 3, 4]) {
			const tip = valueTooltip(tier);
			expect(tip).toContain(`Trade Value ${tier}:`);
			expect(tip).toContain(VALUE_TIER_WORTH[tier]);
			expect(tip).toContain("tiers, not linear");
		}
	});

	it("accepts the tier as a string (as captured from the regex)", () => {
		expect(valueTooltip("2")).toBe(valueTooltip(2));
	});

	it("names both endpoints of a range", () => {
		const tip = valueTooltip("0", "2");
		expect(tip).toContain("Trade Value 0–2");
		expect(tip).toContain("(Value 0)");
		expect(tip).toContain("(Value 2)");
	});

	it("falls back to a generic note for tiers above the named ones", () => {
		const tip = valueTooltip(5);
		expect(tip).toContain("Trade Value 5");
		expect(tip).toContain("exceptional wealth");
	});

	it("returns null for non-tier input", () => {
		expect(valueTooltip("x")).toBeNull();
		expect(valueTooltip(-1)).toBeNull();
		expect(valueTooltip(undefined)).toBeNull();
	});
});
