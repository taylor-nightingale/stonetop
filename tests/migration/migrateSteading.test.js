import { describe, expect, it } from "vitest";
import { migrateSteading } from "../../src/migration/migrateSteading.js";
import { FakeActorBuilder } from "../fakes/FakeActorBuilder.js";

const DEFAULTS = {
	improvements: ["market", "mill"],
	attributes: { fortunes: 1, surplus: 1, size: "village", population: 0, prosperity: 0, defenses: 0 },
};

// A legacy (pre-Stage-C) steading: ratings stored as INDICES into [-1,0,1,2,3], size as an index,
// resources/fortifications inside attributes.*.items, places as bare strings, resident pool in
// residentNames/residentTraits, people in `residents`, pick state in improvements.pickValues.
function legacySteading() {
	return new FakeActorBuilder().withType("steading").withSystem({
		fortunes: 2,   // index → +1
		surplus:  1,
		attributes: {
			size:       { current: 1, items: [] },                        // → "village"
			population: { current: 1, items: [] },                        // → +0
			prosperity: { current: 3, items: ["Farming", "Distilling"] }, // → +2, resources
			defenses:   { current: 0, items: ["Village militia"] },       // → -1, fortifications
		},
		assets: { items: ["A wagon"], coinage: [{ title: "silver", purses: 0, handfuls: 0, coins: 0 }] },
		placesOfInterest: ["The Stone", "The Granary"],
		neighborPlaces: [{ slug: "marshedge", name: "Marshedge", subtitle: "", note: "", names: "Abben" }],
		residentNames: "Aderyn, Bryn",
		residentTraits: ["curious", "stoic"],
		residents: [{ id: "1", name: "Afon" }],
		improvements: { pickValues: { market: { offer: 1 } } },
		debilities: { diminished: true, lacking: false, malcontent: false },
	}).build();
}

describe("migrateSteading (legacy index shape → actual-value shape)", () => {
	it("converts ratings from indices to actual values and size to its tier", async () => {
		const actor = legacySteading();
		await migrateSteading(actor, DEFAULTS);
		expect(actor.system.attributes).toEqual({
			fortunes: 1, surplus: 1, size: "village", population: 0, prosperity: 2, defenses: -1,
		});
	});

	it("moves the resource/fortification lists into assets", async () => {
		const actor = legacySteading();
		await migrateSteading(actor, DEFAULTS);
		expect(actor.system.assets.items).toEqual(["A wagon"]);
		expect(actor.system.assets.resources).toEqual(["Farming", "Distilling"]);
		expect(actor.system.assets.fortifications).toEqual(["Village militia"]);
		expect(actor.system.assets.coinage[0].title).toBe("silver");
	});

	it("reshapes places to objects and folds the resident pool + people", async () => {
		const actor = legacySteading();
		await migrateSteading(actor, DEFAULTS);
		expect(actor.system.placesOfInterest).toEqual([
			{ name: "The Stone", journalReference: "" },
			{ name: "The Granary", journalReference: "" },
		]);
		expect(actor.system.residents).toEqual({ names: "Aderyn, Bryn", traits: ["curious", "stoic"] });
		expect(actor.system.residentPeople).toEqual([{ id: "1", name: "Afon" }]);
	});

	it("sets the steadfast, seeds owned improvements, and keeps pick state", async () => {
		const actor = legacySteading();
		await migrateSteading(actor, DEFAULTS);
		expect(actor.system.steadfast).toBe("stonetop");
		expect(actor.system.improvements).toEqual(["market", "mill"]);
		expect(actor.system.improvementValues).toEqual({ market: { offer: 1 } });
	});

	it("captures the steadfast's starting-attribute baseline (for the 'Starts at …' notes)", async () => {
		const actor = legacySteading();
		await migrateSteading(actor, DEFAULTS);
		expect(actor.system.startingAttributes).toEqual({
			fortunes: 1, surplus: 1, size: "village", population: 0, prosperity: 0, defenses: 0,
		});
	});

	it("preserves untouched runtime state (debilities)", async () => {
		const actor = legacySteading();
		await migrateSteading(actor, DEFAULTS);
		expect(actor.system.debilities.diminished).toBe(true);
	});

	it("is idempotent — an already-migrated steading (steadfast set) is left alone", async () => {
		const actor = new FakeActorBuilder().withType("steading").withSystem({
			steadfast: "stonetop",
			attributes: { fortunes: 1, surplus: 1, size: "village", population: 0, prosperity: 0, defenses: 0 },
		}).build();
		await migrateSteading(actor, DEFAULTS);
		expect(actor.system.attributes.prosperity).toBe(0);
	});
});

// Very old steadings kept people / pick state in FLAGS. Those sources still land in the new fields.
describe("migrateSteading — flag-legacy sources", () => {
	function withFlags(flags) {
		return new FakeActorBuilder().withType("steading").withFlags(flags).withSystem({}).build();
	}

	it("routes flag people/neighbors/pick state into the new fields", async () => {
		const actor = withFlags({
			"improvements.pickValues": { "imp-1": 1 },
			"steading.residents": [{ name: "Aldric" }],
			"steading.neighborPeople": [{ name: "Mira" }],
		});
		await migrateSteading(actor, DEFAULTS);
		expect(actor.system.improvementValues).toEqual({ "imp-1": 1 });
		expect(actor.system.residentPeople).toEqual([{ name: "Aldric" }]);
		expect(actor.system.neighborPeople).toEqual([{ name: "Mira" }]);
	});
});
