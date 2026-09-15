import { describe, it, expect } from "vitest";
import { steadingProfileSchema, steadingRatingsSchema, neighborPlaceFields } from "../../src/data/steadingProfileSchema.js";

// The shared shape used by BOTH SteadfastData and SteadingData, so the two can't drift. Built from
// the fake foundry.data.fields the test setup installs; a blank profile is an empty place.
const f = foundry.data.fields;
const blank = () => new f.SchemaField(steadingProfileSchema(f)).initialize({});

describe("steadingProfileSchema", () => {
	it("exposes exactly the shared steading-definition fields", () => {
		expect(Object.keys(steadingProfileSchema(f)).sort()).toEqual(
			["assets", "attributes", "impressions", "improvements", "neighborPlaces", "placesOfInterest", "residents"],
		);
	});

	it("shares the ratings shape via steadingRatingsSchema (size a string, the rest numbers)", () => {
		const ratings = new f.SchemaField(steadingRatingsSchema(f)).initialize({});
		expect(ratings).toEqual({ fortunes: 0, surplus: 0, size: "", population: 0, prosperity: 0, defenses: 0 });
	});

	it("returns fresh field instances each call (safe to compose into two models)", () => {
		expect(steadingProfileSchema(f).attributes).not.toBe(steadingProfileSchema(f).attributes);
	});

	it("defaults attributes to an empty size tier and every rating 0", () => {
		expect(blank().attributes).toEqual({ fortunes: 0, surplus: 0, size: "", population: 0, prosperity: 0, defenses: 0 });
	});

	it("defaults the asset lists to empty arrays", () => {
		expect(blank().assets).toEqual({ items: [], resources: [], fortifications: [], coinage: [] });
	});

	it("defaults places, neighbors, residents pool, and improvements to empty", () => {
		const b = blank();
		expect(b.placesOfInterest).toEqual([]);
		expect(b.neighborPlaces).toEqual([]);
		expect(b.residents).toEqual({ names: "", traits: [] });
		expect(b.improvements).toEqual([]);
	});

	// One shape, three kinds of field: synced (name/subtitle/names/size), seeded (travel) and record
	// (note). What separates them is not the schema but what a steadfast is allowed to do to each —
	// see applySteadfast and migrateNeighborPlaces, which both apply exactly that.
	it("shapes a neighbouring place with the book's size and its travel time", () => {
		expect(Object.keys(neighborPlaceFields(f)).sort())
			.toEqual(["name", "names", "note", "size", "slug", "subtitle", "travel"]);
	});

	it("defaults a neighbouring place's size to unset rather than the first tier", () => {
		const profile = new f.SchemaField(steadingProfileSchema(f)).initialize({
			neighborPlaces: [{ slug: "steplands", name: "The Steplands" }],
		});
		expect(profile.neighborPlaces).toEqual(
			[{ slug: "steplands", name: "The Steplands", subtitle: "", note: "", names: "", size: "", travel: "" }],
		);
	});

	it("shapes a coinage row and a place of interest as typed records", () => {
		const profile = new f.SchemaField(steadingProfileSchema(f)).initialize({
			assets: { coinage: [{ title: "silver", purses: 2 }] },
			placesOfInterest: [{ name: "The Stone" }],
		});
		expect(profile.assets.coinage).toEqual([{ title: "silver", purses: 2, handfuls: 0, coins: 0 }]);
		expect(profile.placesOfInterest).toEqual([{ name: "The Stone", linkUuid: "" }]);
	});
});
