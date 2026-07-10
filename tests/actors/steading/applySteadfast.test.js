import { describe, it, expect } from "vitest";
import { applySteadfast, matchSteadfastByName } from "../../../src/actors/steading/applySteadfast.js";
import { FakeActorBuilder } from "../../fakes/FakeActorBuilder.js";

describe("matchSteadfastByName", () => {
	const list = [
		{ slug: "stonetop", name: "Stonetop" },
		{ slug: "barrier-pass", name: "Barrier Pass" },
	];

	it("matches a steadfast by name, ignoring case and surrounding space", () => {
		expect(matchSteadfastByName("  barrier pass ", list)).toEqual({ slug: "barrier-pass", name: "Barrier Pass" });
	});

	it("returns null for a custom name that matches no steadfast", () => {
		expect(matchSteadfastByName("Havenrock", list)).toBeNull();
	});

	it("returns null for a blank name", () => {
		expect(matchSteadfastByName("", list)).toBeNull();
		expect(matchSteadfastByName("   ", list)).toBeNull();
		expect(matchSteadfastByName(null, list)).toBeNull();
	});
});

const steadfast = () => ({
	name: "Stonetop",
	system: {
		slug: "stonetop",
		attributes: { fortunes: 1, surplus: 1, size: "village", population: 0, prosperity: 0, defenses: 0 },
		assets: { items: ["wagon"], resources: ["Farming"], fortifications: ["militia"], coinage: [{ title: "silver", purses: 0, handfuls: 0, coins: 0 }] },
		placesOfInterest: [{ name: "The Stone", journalReference: "" }],
		neighborPlaces: [{ slug: "marshedge", name: "Marshedge", subtitle: "", note: "", names: "Abben" }],
		residents: { names: "Aderyn", traits: ["curious"] },
		improvements: ["market", "mill"],
	},
});

function makeSteading(overrides = {}) {
	return new FakeActorBuilder().withType("steading").withSystem({
		steadfast: "",
		residentPeople: [{ id: "1", name: "Afon" }],
		neighborPeople: [{ id: "2", name: "Brin" }],
		debilities: { diminished: true, lacking: false, malcontent: false },
		improvementValues: { market: { offer: 1 } },
		...overrides,
	}).build();
}

describe("applySteadfast", () => {
	it("records which steadfast was applied", async () => {
		const actor = makeSteading();
		await applySteadfast(actor, steadfast());
		expect(actor.system.steadfast).toBe("stonetop");
	});

	it("names the steading after the steadfast", async () => {
		const actor = makeSteading();
		await applySteadfast(actor, steadfast());
		expect(actor.name).toBe("Stonetop");
	});

	it("copies the steadfast's definition fields onto the steading", async () => {
		const actor = makeSteading();
		await applySteadfast(actor, steadfast());
		expect(actor.system.attributes).toEqual(steadfast().system.attributes);
		expect(actor.system.assets).toEqual(steadfast().system.assets);
		expect(actor.system.placesOfInterest).toEqual([{ name: "The Stone", journalReference: "" }]);
		expect(actor.system.neighborPlaces[0].slug).toBe("marshedge");
		expect(actor.system.residents).toEqual({ names: "Aderyn", traits: ["curious"] });
		expect(actor.system.improvements).toEqual(["market", "mill"]);
	});

	it("captures the steadfast's attributes as the immutable starting baseline", async () => {
		const actor = makeSteading();
		await applySteadfast(actor, steadfast());
		expect(actor.system.startingAttributes).toEqual(steadfast().system.attributes);
	});

	it("leaves the steading's runtime state untouched", async () => {
		const actor = makeSteading();
		await applySteadfast(actor, steadfast());
		expect(actor.system.residentPeople).toEqual([{ id: "1", name: "Afon" }]);
		expect(actor.system.neighborPeople).toEqual([{ id: "2", name: "Brin" }]);
		expect(actor.system.debilities.diminished).toBe(true);
		expect(actor.system.improvementValues).toEqual({ market: { offer: 1 } });
	});

	it("copies independently — editing the steading does not mutate the steadfast", async () => {
		const source = steadfast();
		const actor = makeSteading();
		await applySteadfast(actor, source);
		actor.system.improvements.push("inn");
		actor.system.attributes.prosperity = 3;
		expect(source.system.improvements).toEqual(["market", "mill"]);
		expect(source.system.attributes.prosperity).toBe(0);
	});
});
