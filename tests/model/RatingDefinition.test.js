import { describe, it, expect } from "vitest";
import { RatingDefinition } from "../../src/model/data/steading/RatingDefinition.js";
import { SteadingDefaults } from "../../src/model/data/steading/SteadingDefaults.js";

// The fake game.i18n returns the key unchanged from localize(), so these assert on keys. The
// "every key resolves" test at the bottom is what proves the keys are real.

describe("RatingDefinition", () => {
	describe("a ±N rating", () => {
		const def = new RatingDefinition("population", {
			titleKey: "stonetop.steading.attr.population",
			bonuses:  [-1, 0, 1, 2, 3],
		});

		it("stores the bonuses as its values", () => {
			expect(def.values).toEqual([-1, 0, 1, 2, 3]);
			expect(def.isNumeric).toBe(true);
		});

		it("derives min and max from the ends of the range", () => {
			expect(def.min).toBe(-1);
			expect(def.max).toBe(3);
		});

		it("localizes its title", () => {
			expect(def.title).toBe("stonetop.steading.attr.population");
		});

		it("has no tier word", () => {
			expect(def.tierLabel(1)).toBe("");
		});
	});

	describe("defenses, which names a tier per value", () => {
		const def = SteadingDefaults.attributes.defenses;

		it("names the tier for a stored value", () => {
			expect(def.tierLabel(-1)).toBe("stonetop.steading.tier.defenses.feeble");
			expect(def.tierLabel(0)).toBe("stonetop.steading.tier.defenses.mediocre");
			expect(def.tierLabel(3)).toBe("stonetop.steading.tier.defenses.legendary");
		});

		it("names nothing for a value outside the range", () => {
			expect(def.tierLabel(9)).toBe("");
			expect(def.indexOf(9)).toBe(-1);
		});
	});

	describe("size, which stores a tier string rather than a number", () => {
		const def = SteadingDefaults.attributes.size;

		it("is not numeric and has no min or max", () => {
			expect(def.isNumeric).toBe(false);
			expect(def.min).toBe(null);
			expect(def.max).toBe(null);
		});

		it("stores the tier strings as its values", () => {
			expect(def.values).toEqual(["hamlet", "village", "town", "city"]);
		});

		it("names the tier and its population band", () => {
			expect(def.tierLabel("village")).toBe("stonetop.steading.tier.size.village");
			expect(def.band("village")).toBe("stonetop.steading.band.village");
		});

		it("offers one select option per value, marking the current one", () => {
			const options = def.selectOptions("town");
			expect(options.length).toBe(4);
			expect(options.map(o => o.value)).toEqual(["hamlet", "village", "town", "city"]);
			expect(options[1].selected).toBe(false);
			expect(options[2].selected).toBe(true);
			expect(options[2].label).toBe("stonetop.steading.tier.size.town");
			expect(options[2].band).toBe("stonetop.steading.band.town");
		});
	});

	describe("surplus, which is open-ended above zero", () => {
		const def = SteadingDefaults.surplus;

		it("floors at zero and has no ceiling", () => {
			expect(def.min).toBe(0);
			expect(def.max).toBe(null);
		});
	});

	it("every i18n key the steading definitions name exists in en.json", () => {
		const defs = [
			SteadingDefaults.fortunes,
			SteadingDefaults.surplus,
			...Object.values(SteadingDefaults.attributes),
		];
		const missing = defs.flatMap(def => def.i18nKeys).filter(key => !game.i18n.has(key));
		expect(missing).toEqual([]);
	});
});
