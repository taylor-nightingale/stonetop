import { describe, it, expect } from "vitest";
import { NeighborPlaces } from "../../../module/actors/steading/NeighborPlaces.js";
import { FakeActorBuilder } from "../../fakes/FakeActorBuilder.js";

function make() {
	return new NeighborPlaces(new FakeActorBuilder().build());
}

describe("NeighborPlaces.buildSnapshot", () => {
	it("returns empty array by default", () => {
		expect(make().buildSnapshot()).toEqual([]);
	});
});

describe("NeighborPlaces.addPlace", () => {
	it("adds a blank place", async () => {
		const np = make();
		await np.addPlace();
		const snap = np.buildSnapshot();
		expect(snap).toHaveLength(1);
		expect(snap[0].name).toBe("");
		expect(snap[0].note).toBe("");
		expect(snap[0].names).toEqual([]);
	});

	it("each place gets a unique id", async () => {
		const np = make();
		await np.addPlace();
		await np.addPlace();
		const [a, b] = np.buildSnapshot();
		expect(a.id).not.toBe(b.id);
	});
});

describe("NeighborPlaces.removePlace", () => {
	it("removes the place by id", async () => {
		const np = make();
		await np.addPlace();
		const id = np.buildSnapshot()[0].id;
		await np.removePlace(id);
		expect(np.buildSnapshot()).toHaveLength(0);
	});

	it("does not remove other places", async () => {
		const np = make();
		await np.addPlace();
		await np.addPlace();
		const [first, second] = np.buildSnapshot();
		await np.removePlace(first.id);
		expect(np.buildSnapshot()[0].id).toBe(second.id);
	});
});

describe("NeighborPlaces.updatePlace", () => {
	it("updates name field", async () => {
		const np = make();
		await np.addPlace();
		const id = np.buildSnapshot()[0].id;
		await np.updatePlace(id, "name", "Gordin's Delve");
		expect(np.buildSnapshot()[0].name).toBe("Gordin's Delve");
	});

	it("updates note field", async () => {
		const np = make();
		await np.addPlace();
		const id = np.buildSnapshot()[0].id;
		await np.updatePlace(id, "note", "Trade partners to the east");
		expect(np.buildSnapshot()[0].note).toBe("Trade partners to the east");
	});

	it("does not affect other places", async () => {
		const np = make();
		await np.addPlace();
		await np.addPlace();
		const [first, second] = np.buildSnapshot();
		await np.updatePlace(first.id, "name", "Gordin's Delve");
		expect(np.buildSnapshot().find(p => p.id === second.id).name).toBe("");
	});
});

describe("NeighborPlaces.addName", () => {
	it("appends an empty name to the place", async () => {
		const np = make();
		await np.addPlace();
		const id = np.buildSnapshot()[0].id;
		await np.addName(id);
		expect(np.buildSnapshot()[0].names).toEqual([""]);
	});

	it("does not affect other places", async () => {
		const np = make();
		await np.addPlace();
		await np.addPlace();
		const [first, second] = np.buildSnapshot();
		await np.addName(first.id);
		expect(np.buildSnapshot().find(p => p.id === second.id).names).toEqual([]);
	});
});

describe("NeighborPlaces.removeName", () => {
	it("removes the name at the given index", async () => {
		const np = make();
		await np.addPlace();
		const id = np.buildSnapshot()[0].id;
		await np.addName(id);
		await np.addName(id);
		await np.updateName(id, 0, "Wyn");
		await np.updateName(id, 1, "Aeron");
		await np.removeName(id, 0);
		expect(np.buildSnapshot()[0].names).toEqual(["Aeron"]);
	});
});

describe("NeighborPlaces.updateName", () => {
	it("updates the name at the given index", async () => {
		const np = make();
		await np.addPlace();
		const id = np.buildSnapshot()[0].id;
		await np.addName(id);
		await np.updateName(id, 0, "Cerys");
		expect(np.buildSnapshot()[0].names[0]).toBe("Cerys");
	});

	it("does not affect other names in the same place", async () => {
		const np = make();
		await np.addPlace();
		const id = np.buildSnapshot()[0].id;
		await np.addName(id);
		await np.addName(id);
		await np.updateName(id, 0, "Wyn");
		await np.updateName(id, 1, "Aeron");
		await np.updateName(id, 0, "Cerys");
		expect(np.buildSnapshot()[0].names[1]).toBe("Aeron");
	});
});
