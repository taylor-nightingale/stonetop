import { describe, it, expect } from "vitest";
import { SteadingData } from "../../src/data/SteadingData.js";

// A steading actor is now generic: a blank one is an EMPTY place. It gets its starting values by
// applying a steadfast (see applySteadfast / the create hook), not from hardcoded schema initializers.
// Its definition fields share steadingProfileSchema with the steadfast; it adds runtime-only state.
describe("SteadingData defaults (blank = empty place)", () => {
	it("defaults the shared definition fields to empty", () => {
		const d = new SteadingData();
		expect(d.attributes).toEqual({ fortunes: 0, surplus: 0, size: "", population: 0, prosperity: 0, defenses: 0 });
		expect(d.assets).toEqual({ items: [], resources: [], fortifications: [], coinage: [] });
		expect(d.placesOfInterest).toEqual([]);
		expect(d.neighborPlaces).toEqual([]);
		expect(d.residents).toEqual({ names: "", traits: [] });
		expect(d.improvements).toEqual([]);
		expect(d.startingAttributes).toEqual({ fortunes: 0, surplus: 0, size: "", population: 0, prosperity: 0, defenses: 0 });
	});

	it("defaults its steadfast reference and text fields to empty, rollMode to normal", () => {
		const d = new SteadingData();
		expect(d.steadfast).toBe("");
		expect(d.description).toBe("");
		expect(d.notes).toBe("");
		expect(d.rollMode).toBe("normal");
	});

	it("defaults all debilities to false", () => {
		const d = new SteadingData();
		expect(d.debilities).toEqual({ diminished: false, lacking: false, malcontent: false });
	});

	it("defaults all content sections to empty", () => {
		const d = new SteadingData();
		expect(d.content.excluded).toEqual([]);
		expect(d.content.veiled).toEqual([]);
		expect(d.content.specialHandling).toEqual([]);
		expect(d.content.excludedText).toBe("");
	});

	it("defaults the runtime instance lists + pick state to empty", () => {
		const d = new SteadingData();
		expect(d.residentPeople).toEqual([]);
		expect(d.neighborPeople).toEqual([]);
		expect(d.improvementValues).toEqual({});
	});
});

describe("SteadingData with applied values", () => {
	it("stores actual rating numbers and the size tier", () => {
		const d = new SteadingData({ attributes: { fortunes: 1, surplus: 1, size: "village", population: 0, prosperity: 0, defenses: 0 } });
		expect(d.attributes.fortunes).toBe(1);
		expect(d.attributes.size).toBe("village");
		expect(d.attributes.prosperity).toBe(0);
	});

	it("records which steadfast it came from and the improvements it owns", () => {
		const d = new SteadingData({ steadfast: "stonetop", improvements: ["market", "mill"] });
		expect(d.steadfast).toBe("stonetop");
		expect(d.improvements).toEqual(["market", "mill"]);
	});

	it("keeps the resident pool distinct from the resident people", () => {
		const d = new SteadingData({
			residents: { names: "Aderyn, Bryn", traits: ["curious"] },
			residentPeople: [{ id: "1", name: "Afon" }],
		});
		expect(d.residents).toEqual({ names: "Aderyn, Bryn", traits: ["curious"] });
		expect(d.residentPeople).toEqual([{ id: "1", name: "Afon" }]);
	});

	it("accepts debilities overrides", () => {
		const d = new SteadingData({ debilities: { diminished: true } });
		expect(d.debilities.diminished).toBe(true);
		expect(d.debilities.lacking).toBe(false);
	});
});
