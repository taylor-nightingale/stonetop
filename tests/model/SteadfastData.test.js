import { describe, it, expect } from "vitest";
import { SteadfastData } from "../../src/data/SteadfastData.js";

describe("SteadfastData defaults", () => {
	it("defaults slug and sortOrder to null", () => {
		const d = new SteadfastData();
		expect(d.slug).toBeNull();
		expect(d.sortOrder).toBeNull();
	});

	it("defaults description to empty string", () => {
		const d = new SteadfastData();
		expect(d.description).toBe("");
	});

	it("defaults the starting attributes: empty size tier, every number 0 (a blank steadfast is an empty place)", () => {
		const d = new SteadfastData();
		expect(d.attributes).toEqual({ fortunes: 0, surplus: 0, size: "", population: 0, prosperity: 0, defenses: 0 });
	});

	it("defaults the asset lists (items, resources, fortifications, coinage) to empty arrays", () => {
		const d = new SteadfastData();
		expect(d.assets).toEqual({ items: [], resources: [], fortifications: [], coinage: [] });
	});

	it("defaults places, neighbors, residents, and improvements to empty", () => {
		const d = new SteadfastData();
		expect(d.placesOfInterest).toEqual([]);
		expect(d.neighborPlaces).toEqual([]);
		expect(d.residents).toEqual({ names: "", traits: [] });
		expect(d.improvements).toEqual([]);
	});
});

describe("SteadfastData authored values", () => {
	it("keeps the granted-improvement list as a string array", () => {
		const d = new SteadfastData({ improvements: ["market", "mill", "inn"] });
		expect(d.improvements).toEqual(["market", "mill", "inn"]);
	});

	it("stores size as a named tier string and fortunes/surplus/ratings as actual numbers", () => {
		const d = new SteadfastData({ attributes: { fortunes: 1, surplus: 1, size: "village", population: 0, prosperity: 0, defenses: 0 } });
		expect(d.attributes.size).toBe("village");
		expect(d.attributes.fortunes).toBe(1);
		expect(d.attributes.surplus).toBe(1);
		expect(d.attributes.population).toBe(0);
	});

	it("keeps the Prosperity/Defenses source lists under assets.resources/fortifications", () => {
		const d = new SteadfastData({
			assets: { resources: ["Farming", "Distilling"], fortifications: ["Village militia"] },
		});
		expect(d.assets.resources).toEqual(["Farming", "Distilling"]);
		expect(d.assets.fortifications).toEqual(["Village militia"]);
	});

	it("shapes each place of interest as { name, journalReference }, filling a blank reference", () => {
		const d = new SteadfastData({ placesOfInterest: [{ name: "The Stone" }] });
		expect(d.placesOfInterest).toEqual([{ name: "The Stone", journalReference: "" }]);
	});

	it("shapes each coinage row as a typed record, filling missing counts with 0", () => {
		const d = new SteadfastData({ assets: { coinage: [{ title: "silver", purses: 2 }] } });
		expect(d.assets.coinage).toEqual([{ title: "silver", purses: 2, handfuls: 0, coins: 0 }]);
	});

	it("groups residents into { names, traits }", () => {
		const d = new SteadfastData({ residents: { names: "Aderyn, Bryn", traits: ["curious", "stoic"] } });
		expect(d.residents.names).toBe("Aderyn, Bryn");
		expect(d.residents.traits).toEqual(["curious", "stoic"]);
	});
});
