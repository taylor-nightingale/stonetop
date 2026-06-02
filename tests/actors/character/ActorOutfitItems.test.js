import {describe, expect, it} from "vitest";
import {ActorOutfitItems} from "../../../src/actors/character/ActorOutfitItems.js";
import {FakeActorBuilder} from "../../fakes/FakeActorBuilder.js";

function makeRawItem(overrides = {}) {
	return {
		_id:    overrides._id  ?? "item-1",
		type:   overrides.type ?? "outfitItem",
		name:   overrides.name ?? "Test",
		system: { source: overrides.source ?? null, ...(overrides.system ?? {}) },
	};
}

function make(items = []) {
	return new ActorOutfitItems(new FakeActorBuilder().withItems(items).build());
}

describe("ActorOutfitItems.getAll", () => {
	it("returns outfitItem items", () => {
		const aoi = make([makeRawItem()]);
		expect(aoi.getAll()).toHaveLength(1);
	});

	it("excludes non-outfitItem items", () => {
		const aoi = make([makeRawItem({ type: "equipment" })]);
		expect(aoi.getAll()).toHaveLength(0);
	});

	it("excludes move items", () => {
		const aoi = make([makeRawItem({ type: "move" })]);
		expect(aoi.getAll()).toHaveLength(0);
	});

	it("returns empty array when actor has no items", () => {
		expect(new ActorOutfitItems(new FakeActorBuilder().withItems([]).build()).getAll()).toHaveLength(0);
	});
});

describe("ActorOutfitItems.getBySource", () => {
	it("returns items matching the given source", () => {
		const aoi = make([
			makeRawItem({ _id: "a", source: "arcana:sword" }),
			makeRawItem({ _id: "b", source: "possession:smithy" }),
		]);
		expect(aoi.getBySource("arcana:sword")).toHaveLength(1);
		expect(aoi.getBySource("arcana:sword")[0]._id).toBe("a");
	});

	it("returns empty array when no items match", () => {
		const aoi = make([makeRawItem({ source: "arcana:sword" })]);
		expect(aoi.getBySource("possession:smithy")).toHaveLength(0);
	});

	it("excludes items with no source when filtering by source", () => {
		const aoi = make([makeRawItem({ source: null })]);
		expect(aoi.getBySource("arcana:sword")).toHaveLength(0);
	});
});

describe("ActorOutfitItems.create", () => {
	it("creates the given items on the actor", async () => {
		const actor = new FakeActorBuilder().withItems([]).build();
		const aoi = new ActorOutfitItems(actor);
		await aoi.create([{ name: "X", type: "outfitItem" }]);
		expect(actor.createdDocs).toHaveLength(1);
	});

	it("is a no-op when items array is empty", async () => {
		const actor = new FakeActorBuilder().withItems([]).build();
		const aoi = new ActorOutfitItems(actor);
		await aoi.create([]);
		expect(actor.createdDocs).toHaveLength(0);
	});
});

describe("ActorOutfitItems.deleteBySource", () => {
	it("deletes all items with the matching source", async () => {
		const actor = new FakeActorBuilder().withItems([
			makeRawItem({_id: "a", source: "arcana:sword"}),
			makeRawItem({_id: "b", source: "arcana:sword"}),
		]).build();
		const aoi = new ActorOutfitItems(actor);
		await aoi.deleteBySource("arcana:sword");
		expect(actor.deletedIds).toEqual(["a", "b"]);
	});

	it("is a no-op when no items match", async () => {
		const actor = new FakeActorBuilder().withItems([makeRawItem({source: "arcana:bow"})]).build();
		const aoi = new ActorOutfitItems(actor);
		await aoi.deleteBySource("arcana:sword");
		expect(actor.deletedIds).toHaveLength(0);
	});
});

describe("ActorOutfitItems.deleteById", () => {
	it("deletes the single item with the given id", async () => {
		const actor = new FakeActorBuilder().withItems([]).build();
		const aoi = new ActorOutfitItems(actor);
		await aoi.deleteById("item-42");
		expect(actor.deletedIds).toEqual(["item-42"]);
	});
});

describe("ActorOutfitItems.sync", () => {
	it("deletes existing items with the source then creates the new ones", async () => {
		const actor = new FakeActorBuilder().withItems([makeRawItem({_id: "old", source: "arcana:sword"})]).build();
		const aoi = new ActorOutfitItems(actor);
		await aoi.sync("arcana:sword", [{ name: "New Sword", type: "outfitItem" }]);
		expect(actor.deletedIds).toEqual(["old"]);
		expect(actor.createdDocs).toHaveLength(1);
	});

	it("skips create when new items array is empty", async () => {
		const actor = new FakeActorBuilder().withItems([makeRawItem({_id: "old", source: "arcana:sword"})]).build();
		const aoi = new ActorOutfitItems(actor);
		await aoi.sync("arcana:sword", []);
		expect(actor.deletedIds).toEqual(["old"]);
		expect(actor.createdDocs).toHaveLength(0);
	});

	it("skips delete when no existing items match source", async () => {
		const actor = new FakeActorBuilder().withItems([]).build();
		const aoi = new ActorOutfitItems(actor);
		await aoi.sync("arcana:sword", [{ name: "Sword", type: "outfitItem" }]);
		expect(actor.deletedIds).toHaveLength(0);
		expect(actor.createdDocs).toHaveLength(1);
	});
});
