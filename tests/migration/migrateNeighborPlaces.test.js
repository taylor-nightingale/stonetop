import { describe, it, expect, vi, beforeEach } from "vitest";

// Only the pack-touching piece is mocked; nothing else in applySteadfast is used here.
vi.mock("../../src/actors/steading/applySteadfast.js", async importOriginal => ({
	...(await importOriginal()),
	loadSteadfast: vi.fn(async () => null),
}));

import { migrateNeighborPlaces } from "../../src/migration/migrateNeighborPlaces.js";
import { loadSteadfast } from "../../src/actors/steading/applySteadfast.js";
import { FakeActorBuilder } from "../fakes/FakeActorBuilder.js";

// What the steadfast defines today — Gordin's Delve no longer carries the subtitle it once did.
const DEFINED = [
	{ slug: "marshedge",     name: "Marshedge",      subtitle: "",          names: "Abben, Ailen" },
	{ slug: "gordins-delve", name: "Gordin's Delve", subtitle: "",          names: "" },
	{ slug: "steplands",     name: "The Steplands",  subtitle: "Hillfolk",  names: "Adm, Blej" },
];

// What a world seeded from an older copy of it still holds: the retired subtitle, a stale name pool,
// the table's own notes, and a place the steadfast has since stopped defining.
function seededSteading(places = [
	{ slug: "marshedge",     name: "Marshedge",      subtitle: "",           note: "Owes us grain", names: "Abben" },
	{ slug: "gordins-delve", name: "Gordin's Delve", subtitle: "Choose from other lists; everyone comes to Gordin's Delve from somewhere else.", note: "Traded iron", names: "" },
	{ slug: "the-swamp",     name: "The Swamp",      subtitle: "ours",       note: "We named it",   names: "Gurl" },
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
		expect(actor.system.neighborPlaces.map(p => p.note))
			.toEqual(["Owes us grain", "Traded iron", "We named it"]);
	});

	it("keeps a row the steadfast no longer defines, as it stands", async () => {
		const actor = seededSteading();
		await migrateNeighborPlaces(actor);
		expect(actor.system.neighborPlaces[2]).toMatchObject({ slug: "the-swamp", subtitle: "ours", names: "Gurl" });
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
