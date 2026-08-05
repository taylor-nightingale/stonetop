import { describe, it, expect } from "vitest";
import { ArmorBreakdown, ArmorContribution } from "../../../../src/model/data/character/ArmorBreakdown.js";
import { OutfitItemBuilder } from "../../../../src/model/data/character/OutfitItem.js";

function makeItem(name, armor) {
	return new OutfitItemBuilder()
		.withSlug(name.toLowerCase().replace(/\s+/g, "-"))
		.withName(name)
		.withWeight(1)
		.withInventoryColumn("regular")
		.withArmor(armor)
		.build();
}

describe("ArmorBreakdown.fromItems — value", () => {
	it("is 0 for no items", () => {
		expect(ArmorBreakdown.fromItems([]).value).toBe(0);
	});

	it("is the base of a single base-armor item", () => {
		expect(ArmorBreakdown.fromItems([makeItem("Thick hides", { base: 1 })]).value).toBe(1);
	});

	it("counts only the highest base when two armors are worn", () => {
		const items = [makeItem("Thick hides", { base: 1 }), makeItem("Chain mail", { base: 3 })];
		expect(ArmorBreakdown.fromItems(items).value).toBe(3);
	});

	it("adds every modifier on top of the base", () => {
		const items = [
			makeItem("Chain mail", { base: 2 }),
			makeItem("Shield", { modifier: 1 }),
			makeItem("Charm", { modifier: 1 }),
		];
		expect(ArmorBreakdown.fromItems(items).value).toBe(4);
	});

	it("is the modifier alone when no armor is worn", () => {
		expect(ArmorBreakdown.fromItems([makeItem("Shield", { modifier: 1 })]).value).toBe(1);
	});

	it("ignores items that grant no armor", () => {
		expect(ArmorBreakdown.fromItems([makeItem("Cloak", null)]).value).toBe(0);
	});
});

describe("ArmorBreakdown.fromItems — contributions", () => {
	it("has none for items that grant no armor", () => {
		const breakdown = ArmorBreakdown.fromItems([makeItem("Cloak", null)]);
		expect(breakdown.contributions).toEqual([]);
		expect(breakdown.isEmpty).toBe(true);
	});

	it("names the winning base and marks it as base", () => {
		const items = [makeItem("Thick hides", { base: 1 }), makeItem("Chain mail", { base: 3 })];
		expect(ArmorBreakdown.fromItems(items).contributions)
			.toEqual([new ArmorContribution("Chain mail", 3, true)]);
	});

	it("leaves out a base that lost to a higher one — it doesn't count toward the value", () => {
		const items = [makeItem("Thick hides", { base: 1 }), makeItem("Chain mail", { base: 3 })];
		const names = ArmorBreakdown.fromItems(items).contributions.map(c => c.name);
		expect(names).not.toContain("Thick hides");
	});

	it("lists the base first, then each modifier", () => {
		const items = [
			makeItem("Shield", { modifier: 1 }),
			makeItem("Chain mail", { base: 2 }),
		];
		expect(ArmorBreakdown.fromItems(items).contributions).toEqual([
			new ArmorContribution("Chain mail", 2, true),
			new ArmorContribution("Shield", 1, false),
		]);
	});

	it("keeps a modifier-only item as a non-base contribution", () => {
		expect(ArmorBreakdown.fromItems([makeItem("Shield", { modifier: 1 })]).contributions)
			.toEqual([new ArmorContribution("Shield", 1, false)]);
	});
});

describe("ArmorBreakdown.empty", () => {
	it("has no contributions and a value of 0", () => {
		const breakdown = ArmorBreakdown.empty();
		expect(breakdown.isEmpty).toBe(true);
		expect(breakdown.value).toBe(0);
	});
});
