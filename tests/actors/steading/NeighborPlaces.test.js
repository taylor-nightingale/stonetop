import { describe, it, expect } from "vitest";
import { NeighborPlaces } from "../../../module/actors/steading/NeighborPlaces.js";
import { SteadingDefaults } from "../../../module/model/data/steading/SteadingDefaults.js";
import { FakeActorBuilder } from "../../fakes/FakeActorBuilder.js";

function make() {
	return new NeighborPlaces(new FakeActorBuilder().build());
}

describe("NeighborPlaces.buildSnapshot — defaults", () => {
	it("seeds 5 default places on first call", async () => {
		const np = make();
		expect(await np.buildSnapshot()).toHaveLength(5);
	});

	it("default places have correct names in order", async () => {
		const np = make();
		const names = (await np.buildSnapshot()).map(p => p.name);
		expect(names).toEqual(["Marshedge", "Gordin's Delve", "The Steplands", "Lygos", "Other places"]);
	});

	it("places with subtitles have correct subtitle", async () => {
		const np = make();
		const snap = await np.buildSnapshot();
		expect(snap.find(p => p.name === "The Steplands").subtitle).toBe("Hillfolk");
		expect(snap.find(p => p.name === "Lygos").subtitle).toBe("and other points south");
		expect(snap.find(p => p.name === "Other places").subtitle).toBe("Barrier Pass, the Manmarch, etc.");
	});

	it("places without subtitles have empty subtitle", async () => {
		const np = make();
		const snap = await np.buildSnapshot();
		expect(snap.find(p => p.name === "Marshedge").subtitle).toBe("");
		expect(snap.find(p => p.name === "Gordin's Delve").subtitle).toBe("");
	});

	it("Marshedge has the correct names string", async () => {
		const np = make();
		const snap = await np.buildSnapshot();
		expect(snap.find(p => p.name === "Marshedge").names).toBe(SteadingDefaults.neighborPlaces[0].names);
	});

	it("each place gets a unique id", async () => {
		const np = make();
		const ids = (await np.buildSnapshot()).map(p => p.id);
		expect(new Set(ids).size).toBe(5);
	});

	it("does not re-seed on subsequent calls", async () => {
		const np = make();
		await np.buildSnapshot();
		const second = await np.buildSnapshot();
		expect(second).toHaveLength(5);
		expect(second[0].id).toBe((await np.buildSnapshot())[0].id);
	});
});

describe("NeighborPlaces.updateNote", () => {
	it("persists the note for the matching place", async () => {
		const np = make();
		const snap = await np.buildSnapshot();
		const id = snap.find(p => p.name === "Marshedge").id;
		await np.updateNote(id, "Key trading partner");
		const updated = (await np.buildSnapshot()).find(p => p.id === id);
		expect(updated.note).toBe("Key trading partner");
	});

	it("does not affect other places", async () => {
		const np = make();
		const snap = await np.buildSnapshot();
		const marshedge = snap.find(p => p.name === "Marshedge");
		const lygos = snap.find(p => p.name === "Lygos");
		await np.updateNote(marshedge.id, "Key trading partner");
		const updated = (await np.buildSnapshot()).find(p => p.id === lygos.id);
		expect(updated.note).toBe("");
	});
});

describe("NeighborPlaces.updateNames", () => {
	it("persists the names string for the matching place", async () => {
		const np = make();
		const snap = await np.buildSnapshot();
		const id = snap.find(p => p.name === "Other places").id;
		await np.updateNames(id, "Edda, Birna, Orm");
		const updated = (await np.buildSnapshot()).find(p => p.id === id);
		expect(updated.names).toBe("Edda, Birna, Orm");
	});

	it("does not affect other places", async () => {
		const np = make();
		const snap = await np.buildSnapshot();
		const other = snap.find(p => p.name === "Other places");
		const marshedge = snap.find(p => p.name === "Marshedge");
		const originalNames = marshedge.names;
		await np.updateNames(other.id, "Edda, Birna");
		const updated = (await np.buildSnapshot()).find(p => p.id === marshedge.id);
		expect(updated.names).toBe(originalNames);
	});
});
