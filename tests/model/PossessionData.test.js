import { describe, it, expect } from "vitest";
import { PossessionData } from "../../src/data/PossessionData.js";

describe("PossessionData defaults", () => {
	it("defaults slug to null", () => {
		expect(new PossessionData().slug).toBeNull();
	});

	it("defaults label and description to empty string", () => {
		const d = new PossessionData();
		expect(d.label).toBe("");
		expect(d.description).toBe("");
	});

	it("defaults resource, choices, scaling, sortOrder to null", () => {
		const d = new PossessionData();
		expect(d.resource).toBeNull();
		expect(d.choices).toBeNull();
		expect(d.scaling).toBeNull();
		expect(d.sortOrder).toBeNull();
	});

	it("defaults outfitItems to empty array", () => {
		expect(new PossessionData().outfitItems).toEqual([]);
	});

	it("defaults selected and preselected to false", () => {
		const d = new PossessionData();
		expect(d.selected).toBe(false);
		expect(d.preselected).toBe(false);
	});

	it("defaults uses to 0", () => {
		expect(new PossessionData().uses).toBe(0);
	});

	it("defaults pickValues and choiceUses to empty objects", () => {
		const d = new PossessionData();
		expect(d.pickValues).toEqual({});
		expect(d.choiceUses).toEqual({});
	});

	it("defaults playbookSlug to null", () => {
		expect(new PossessionData().playbookSlug).toBeNull();
	});
});

describe("PossessionData with initial data", () => {
	it("accepts slug and label", () => {
		const d = new PossessionData({ slug: "sacred-pouch", label: "Sacred pouch" });
		expect(d.slug).toBe("sacred-pouch");
		expect(d.label).toBe("Sacred pouch");
	});

	it("accepts resource object", () => {
		const d = new PossessionData({ resource: { max: 3, title: "Stock", labels: [] } });
		expect(d.resource.max).toBe(3);
		expect(d.resource.title).toBe("Stock");
	});

	it("accepts scaling object", () => {
		const d = new PossessionData({ scaling: { perEvenLevel: 1, perMove: [] } });
		expect(d.scaling.perEvenLevel).toBe(1);
	});
});
