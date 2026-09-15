import { describe, it, expect } from "vitest";
import { applySteadfast, matchSteadfastByName, seedSteadfast } from "../../../src/actors/steading/applySteadfast.js";
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
		placesOfInterest: [{ name: "The Stone", linkUuid: "" }],
		neighborPlaces: [
			{ slug: "marshedge", name: "Marshedge", subtitle: "", note: "", names: "Abben", size: "town", travel: "10 days" },
			{ slug: "lygos",     name: "Lygos",     subtitle: "", note: "", names: "",      size: "",     travel: "40 days" },
		],
		residents: { names: "Aderyn", traits: ["curious"] },
		improvements: ["market", "mill"],
	},
});

function makeSteading(overrides = {}, name = "Test Actor") {
	return new FakeActorBuilder().withType("steading").withName(name).withSystem({
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
		expect(actor.system.placesOfInterest).toEqual([{ name: "The Stone", linkUuid: "" }]);
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

	// A steadfast has no travel times to give — they are measured from ONE steading — so copying its
	// rows wholesale would blank what the table measured, with nothing able to put it back.
	it("keeps the travel times the steading had measured", async () => {
		const actor = makeSteading({ neighborPlaces: [
			{ slug: "marshedge", name: "Marshedge", note: "", names: "", size: "", travel: "4 days, the West Road" },
			{ slug: "lygos",     name: "Lygos",     note: "", names: "", size: "", travel: "months" },
		] });
		await applySteadfast(actor, steadfast());
		expect(actor.system.neighborPlaces.map(p => p.travel)).toEqual(["4 days, the West Road", "months"]);
	});

	// The bug this guards: every steadfast row carries `note: ""`, so copying the rows wholesale wiped
	// the notes a table had kept on its neighbours all campaign — with nothing able to put them back.
	// A note is not part of a definition, which is why re-applying one must not reach it.
	it("keeps the notes the table wrote on its neighbours", async () => {
		const actor = makeSteading({ neighborPlaces: [
			{ slug: "marshedge", name: "Marshedge", note: "Owes us grain", names: "", size: "", travel: "" },
			{ slug: "lygos",     name: "Lygos",     note: "Bought the whole clip", names: "", size: "", travel: "" },
		] });
		await applySteadfast(actor, steadfast());
		expect(actor.system.neighborPlaces.map(p => p.note)).toEqual(["Owes us grain", "Bought the whole clip"]);
	});

	it("leaves a note blank for a place the steading had no row for at all", async () => {
		const actor = makeSteading({ neighborPlaces: [
			{ slug: "marshedge", name: "Marshedge", note: "Owes us grain", names: "", size: "", travel: "" },
		] });
		await applySteadfast(actor, steadfast());
		expect(actor.system.neighborPlaces.find(p => p.slug === "lygos").note).toBe("");
	});

	it("still takes the steadfast's size, which IS the steadfast's to define", async () => {
		const actor = makeSteading({ neighborPlaces: [
			{ slug: "marshedge", name: "Marshedge", note: "", names: "", size: "hamlet", travel: "4 days" },
		] });
		await applySteadfast(actor, steadfast());
		expect(actor.system.neighborPlaces[0]).toMatchObject({ size: "town", travel: "4 days" });
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

// Creating a steading seeds it from a steadfast without taking the steadfast's name: the GM picking
// Stonetop's starting numbers is not asking for their village to be called Stonetop.
describe("seedSteadfast", () => {
	it("keeps the name the steading was created with", async () => {
		const actor = makeSteading({}, "Havenrock");
		await seedSteadfast(actor, steadfast());
		expect(actor.name).toBe("Havenrock");
	});

	it("seeds the same definition fields and baseline applySteadfast does", async () => {
		const actor = makeSteading({}, "Havenrock");
		await seedSteadfast(actor, steadfast());
		expect(actor.system.steadfast).toBe("stonetop");
		expect(actor.system.attributes).toEqual(steadfast().system.attributes);
		expect(actor.system.assets).toEqual(steadfast().system.assets);
		expect(actor.system.residents).toEqual({ names: "Aderyn", traits: ["curious"] });
		expect(actor.system.improvements).toEqual(["market", "mill"]);
		expect(actor.system.startingAttributes).toEqual(steadfast().system.attributes);
	});

	it("leaves the steading's runtime state untouched", async () => {
		const actor = makeSteading({}, "Havenrock");
		await seedSteadfast(actor, steadfast());
		expect(actor.system.residentPeople).toEqual([{ id: "1", name: "Afon" }]);
		expect(actor.system.debilities.diminished).toBe(true);
		expect(actor.system.improvementValues).toEqual({ market: { offer: 1 } });
	});

	// Seeding runs the same update, so it owes the same promise — a steading created from a template
	// that already carries notes keeps them.
	it("keeps the notes and measured travel times the steading already had", async () => {
		const actor = makeSteading({ neighborPlaces: [
			{ slug: "marshedge", name: "Marshedge", note: "Owes us grain", names: "", size: "", travel: "9 days if you push" },
		] }, "Havenrock");
		await seedSteadfast(actor, steadfast());
		expect(actor.system.neighborPlaces.find(p => p.slug === "marshedge"))
			.toMatchObject({ note: "Owes us grain", travel: "9 days if you push", size: "town" });
	});

	it("names an unnamed steading after the steadfast", async () => {
		// Blank, and Foundry's placeholder for a create dialog whose name box was left empty.
		CONFIG.Actor = { typeLabels: { steading: "Steading" } };
		for (const name of ["", "Steading", "Steading (2)"]) {
			const actor = makeSteading({}, name);
			await seedSteadfast(actor, steadfast());
			expect(actor.name).toBe("Stonetop");
		}
		delete CONFIG.Actor;
	});
});
