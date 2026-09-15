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
	});

	it("defaults the runtime instance lists + pick state to empty", () => {
		const d = new SteadingData();
		expect(d.folk).toEqual([]);
		expect(d.improvementValues).toEqual({});
	});
});

// Travel rides the shared neighbour shape, seeded from the steadfast that owns the rows — "from
// here" is unambiguous because only Stonetop's steadfast has neighbour rows at all (build-steadfasts
// writes an empty list for every steadfast it generates).
describe("SteadingData — a neighbouring place's travel time", () => {
	it("carries travel on the neighbour shape, defaulting to empty", () => {
		const d = new SteadingData({ neighborPlaces: [{ slug: "marshedge", name: "Marshedge", size: "town" }] });
		expect(d.neighborPlaces).toEqual(
			[{ slug: "marshedge", name: "Marshedge", subtitle: "", note: "", names: "", size: "town", travel: "" }],
		);
	});

	it("stores whatever prose the table wrote, since the book states these inconsistently", () => {
		const d = new SteadingData({ neighborPlaces: [{ slug: "steplands", travel: "at least a few days' travel" }] });
		expect(d.neighborPlaces[0].travel).toBe("at least a few days' travel");
	});

	// The steadfast is where the book's printed times are AUTHORED, so it holds the field too — that
	// is what makes seeding possible at all.
	it("holds the same field on a steadfast, which is where the book's times are authored", async () => {
		const { SteadfastData } = await import("../../src/data/SteadfastData.js");
		const s = new SteadfastData({ neighborPlaces: [{ slug: "marshedge", travel: "10 days" }] });
		expect(s.neighborPlaces[0].travel).toBe("10 days");
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

	// `residents` is the name/trait POOL the place seeds; `folk` is the people themselves.
	it("keeps the resident pool distinct from the roster", () => {
		const d = new SteadingData({
			residents: { names: "Aderyn, Bryn", traits: ["curious"] },
			folk: [{ id: "1", name: "Afon", home: "" }],
		});
		expect(d.residents).toEqual({ names: "Aderyn, Bryn", traits: ["curious"] });
		expect(d.folk).toEqual([{ id: "1", name: "Afon", home: "" }]);
	});

	it("accepts debilities overrides", () => {
		const d = new SteadingData({ debilities: { diminished: true } });
		expect(d.debilities.diminished).toBe(true);
		expect(d.debilities.lacking).toBe(false);
	});
});
