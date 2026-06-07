import { describe, it, expect } from "vitest";
import { SteadingData } from "../../src/data/SteadingData.js";

describe("SteadingData defaults", () => {
	it("defaults fortunes to 2 and surplus to 1", () => {
		const d = new SteadingData();
		expect(d.fortunes).toBe(2);
		expect(d.surplus).toBe(1);
	});

	it("defaults all debilities to false", () => {
		const d = new SteadingData();
		expect(d.debilities.diminished).toBe(false);
		expect(d.debilities.lacking).toBe(false);
		expect(d.debilities.malcontent).toBe(false);
	});

	it("defaults description and notes to empty string", () => {
		const d = new SteadingData();
		expect(d.description).toBe("");
		expect(d.notes).toBe("");
	});

	it("defaults size and population attributes to current=1 with empty items", () => {
		const d = new SteadingData();
		expect(d.attributes.size.current).toBe(1);
		expect(d.attributes.size.items).toEqual([]);
		expect(d.attributes.population.current).toBe(1);
		expect(d.attributes.population.items).toEqual([]);
	});

	it("defaults prosperity to 8 default items", () => {
		const d = new SteadingData();
		expect(d.attributes.prosperity.current).toBe(1);
		expect(d.attributes.prosperity.items).toHaveLength(8);
		expect(d.attributes.prosperity.items[0]).toContain("Farming");
	});

	it("defaults defenses to 4 default items", () => {
		const d = new SteadingData();
		expect(d.attributes.defenses.current).toBe(1);
		expect(d.attributes.defenses.items).toHaveLength(4);
		expect(d.attributes.defenses.items[0]).toBe("Village militia");
	});

	it("defaults assets with 4 items and 2 coinage entries", () => {
		const d = new SteadingData();
		expect(d.assets.items).toHaveLength(4);
		expect(d.assets.coinage).toHaveLength(2);
		expect(d.assets.coinage[0].title).toBe("silver");
		expect(d.assets.coinage[1].title).toBe("gold");
		expect(d.assets.coinage[0].purses).toBe(0);
	});

	it("defaults all content sections to empty arrays", () => {
		const d = new SteadingData();
		expect(d.content.excluded).toEqual([]);
		expect(d.content.veiled).toEqual([]);
		expect(d.content.specialHandling).toEqual([]);
	});

	it("defaults placesOfInterest to 6 entries starting with The Stone", () => {
		const d = new SteadingData();
		expect(d.placesOfInterest).toHaveLength(6);
		expect(d.placesOfInterest[0]).toBe("The Stone");
	});

	it("defaults neighborPlaces to 5 entries with correct slugs", () => {
		const d = new SteadingData();
		expect(d.neighborPlaces).toHaveLength(5);
		expect(d.neighborPlaces[0].slug).toBe("marshedge");
		expect(d.neighborPlaces[1].slug).toBe("gordins-delve");
		expect(d.neighborPlaces[4].slug).toBe("other");
	});

	it("defaults residentNames to a non-empty string of Welsh names", () => {
		const d = new SteadingData();
		expect(d.residentNames.length).toBeGreaterThan(0);
		expect(d.residentNames).toContain("Aderyn");
	});

	it("defaults residentTraits to 90 entries", () => {
		const d = new SteadingData();
		expect(d.residentTraits.length).toBeGreaterThanOrEqual(90);
		expect(d.residentTraits[0]).toBe("all thumbs");
	});

	it("defaults residents and neighborPeople to empty arrays", () => {
		const d = new SteadingData();
		expect(d.residents).toEqual([]);
		expect(d.neighborPeople).toEqual([]);
	});

	it("defaults improvements.pickValues to empty object", () => {
		expect(new SteadingData().improvements.pickValues).toEqual({});
	});
});

describe("SteadingData function initials produce independent copies", () => {
	it("placesOfInterest arrays are independent between instances", () => {
		const a = new SteadingData();
		const b = new SteadingData();
		a.placesOfInterest.push("extra");
		expect(b.placesOfInterest).toHaveLength(6);
	});

	it("neighborPlaces objects are independent between instances", () => {
		const a = new SteadingData();
		const b = new SteadingData();
		a.neighborPlaces[0].note = "modified";
		expect(b.neighborPlaces[0].note).toBe("");
	});
});

describe("SteadingData with initial data", () => {
	it("accepts custom fortunes", () => {
		expect(new SteadingData({ fortunes: 4 }).fortunes).toBe(4);
	});

	it("accepts debilities overrides", () => {
		const d = new SteadingData({ debilities: { diminished: true } });
		expect(d.debilities.diminished).toBe(true);
		expect(d.debilities.lacking).toBe(false);
	});
});
