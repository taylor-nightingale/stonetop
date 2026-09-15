import { describe, it, expect, vi, beforeEach } from "vitest";

// Only the pack-touching piece is mocked; nothing else in applySteadfast is used here.
vi.mock("../../src/actors/steading/applySteadfast.js", async importOriginal => ({
	...(await importOriginal()),
	loadSteadfast: vi.fn(async () => null),
}));

import { migrateNeighborPlaces } from "../../src/migration/migrateNeighborPlaces.js";
import { loadSteadfast } from "../../src/actors/steading/applySteadfast.js";
import { FakeActorBuilder } from "../fakes/FakeActorBuilder.js";

// What the steadfast defines today — Gordin's Delve no longer carries the subtitle it once did, the
// two that are actually steadings have since been given the book's Size, and every row has since
// been given the travel time the GM playbook prints. Barrier Pass is a row the steadfast has ADDED
// since this world seeded its copy.
const DEFINED = [
	{ slug: "marshedge",     name: "Marshedge",      subtitle: "",         names: "Abben, Ailen", size: "town",    travel: "10 days" },
	{ slug: "gordins-delve", name: "Gordin's Delve", subtitle: "",         names: "",             size: "town",    travel: "4 days" },
	{ slug: "steplands",     name: "The Steplands",  subtitle: "Hillfolk", names: "Adm, Blej",    size: "",        travel: "4 days" },
	{ slug: "barrier-pass",  name: "Barrier Pass",   subtitle: "",         names: "",             size: "village", travel: "5 days" },
];

// What a world seeded from an older copy of it still holds: the retired subtitle, a stale name pool,
// the table's own notes, and a place the steadfast has since stopped defining.
function seededSteading(places = [
	{ slug: "marshedge",     name: "Marshedge",      subtitle: "",           note: "Owes us grain", names: "Abben", travel: "9 days if you push" },
	{ slug: "gordins-delve", name: "Gordin's Delve", subtitle: "Choose from other lists; everyone comes to Gordin's Delve from somewhere else.", note: "Traded iron", names: "", travel: "" },
	{ slug: "the-swamp",     name: "The Swamp",      subtitle: "ours",       note: "We named it",   names: "Gurl", travel: "half a day" },
]) {
	return new FakeActorBuilder().withType("steading")
		.withSystem({ steadfast: "stonetop", neighborPlaces: places }).build();
}

beforeEach(() => {
	loadSteadfast.mockReset();
	loadSteadfast.mockResolvedValue({ system: { neighborPlaces: DEFINED } });
});

describe("migrateNeighborPlaces", () => {
	it("drops a subtitle the steadfast no longer defines", async () => {
		const actor = seededSteading();
		await migrateNeighborPlaces(actor);
		expect(actor.system.neighborPlaces[1].subtitle).toBe("");
	});

	it("refreshes the name and the name pool from the steadfast", async () => {
		const actor = seededSteading();
		await migrateNeighborPlaces(actor);
		expect(actor.system.neighborPlaces[0].names).toBe("Abben, Ailen");
		expect(actor.system.neighborPlaces[0].name).toBe("Marshedge");
	});

	it("keeps the notes the table wrote", async () => {
		const actor = seededSteading();
		await migrateNeighborPlaces(actor);
		const bySlug = Object.fromEntries(actor.system.neighborPlaces.map(p => [p.slug, p.note]));
		expect(bySlug).toMatchObject({ marshedge: "Owes us grain", "gordins-delve": "Traded iron", "the-swamp": "We named it" });
	});

	it("keeps a row the steadfast no longer defines, as it stands", async () => {
		const actor = seededSteading();
		await migrateNeighborPlaces(actor);
		expect(actor.system.neighborPlaces.find(p => p.slug === "the-swamp"))
			.toMatchObject({ subtitle: "ours", names: "Gurl", travel: "half a day" });
	});

	// The other half of "in step". A steading seeded before Barrier Pass was split out of "Other
	// places" would otherwise never see it: this pass used to map over the STEADING's rows, so a row
	// the steadfast had gained had nothing to arrive on.
	it("adds a row the steadfast has defined since the world seeded its copy", async () => {
		const actor = seededSteading();
		await migrateNeighborPlaces(actor);
		expect(actor.system.neighborPlaces.find(p => p.slug === "barrier-pass"))
			.toMatchObject({ name: "Barrier Pass", size: "village", travel: "5 days", note: "" });
	});

	it("puts the rows in the steadfast's order, with the table's own after them", async () => {
		const actor = seededSteading();
		await migrateNeighborPlaces(actor);
		expect(actor.system.neighborPlaces.map(p => p.slug))
			.toEqual(["marshedge", "gordins-delve", "steplands", "barrier-pass", "the-swamp"]);
	});

	// Size is the definitional half: the book's word for the place, so a world seeded before it was
	// authored picks it up here rather than waiting for someone to notice.
	it("brings a size the steadfast now defines into a world seeded without one", async () => {
		const actor = seededSteading();
		await migrateNeighborPlaces(actor);
		const bySlug = Object.fromEntries(actor.system.neighborPlaces.map(p => [p.slug, p.size]));
		expect(bySlug).toMatchObject({ marshedge: "town", "gordins-delve": "town", steplands: "" });
	});

	it("blanks a size the steadfast has stopped defining, rather than leaving a stale one", async () => {
		const actor = seededSteading([{ slug: "steplands", name: "The Steplands", note: "", names: "", size: "hamlet" }]);
		await migrateNeighborPlaces(actor);
		expect(actor.system.neighborPlaces.find(p => p.slug === "steplands").size).toBe("");
	});

	// Travel is SEEDED: the book fills a blank, and never argues with a time the table measured.
	it("writes the book's travel time into a row that has none", async () => {
		const actor = seededSteading();
		await migrateNeighborPlaces(actor);
		expect(actor.system.neighborPlaces.find(p => p.slug === "gordins-delve").travel).toBe("4 days");
	});

	it("leaves a travel time the table wrote itself alone", async () => {
		const actor = seededSteading();
		await migrateNeighborPlaces(actor);
		expect(actor.system.neighborPlaces.find(p => p.slug === "marshedge").travel)
			.toBe("9 days if you push");
	});

	// Blank is whitespace too — a row someone tabbed through is a row with nothing written on it.
	it("treats a whitespace-only travel time as blank", async () => {
		const actor = seededSteading([{ slug: "marshedge", name: "Marshedge", note: "", names: "", travel: "   " }]);
		await migrateNeighborPlaces(actor);
		expect(actor.system.neighborPlaces.find(p => p.slug === "marshedge").travel).toBe("10 days");
	});

	it("is idempotent", async () => {
		const actor = seededSteading();
		await migrateNeighborPlaces(actor);
		const once = JSON.stringify(actor.system.neighborPlaces);
		await migrateNeighborPlaces(actor);
		expect(JSON.stringify(actor.system.neighborPlaces)).toBe(once);
	});

	it("asks for the steading's own steadfast", async () => {
		await migrateNeighborPlaces(seededSteading());
		expect(loadSteadfast).toHaveBeenCalledWith("stonetop");
	});

	it("leaves a steading with no steadfast alone, without touching the pack", async () => {
		const actor = new FakeActorBuilder().withType("steading")
			.withSystem({ neighborPlaces: [{ slug: "marshedge", name: "Marshedge", subtitle: "old", note: "", names: "" }] })
			.build();
		await migrateNeighborPlaces(actor);
		expect(loadSteadfast).not.toHaveBeenCalled();
		expect(actor.system.neighborPlaces[0].subtitle).toBe("old");
	});

	it("leaves the record alone when the steadfast defines no places", async () => {
		loadSteadfast.mockResolvedValue({ system: { neighborPlaces: [] } });
		const actor = seededSteading();
		await migrateNeighborPlaces(actor);
		expect(actor.system.neighborPlaces[1].subtitle).toMatch(/^Choose from other lists/);
	});
});
