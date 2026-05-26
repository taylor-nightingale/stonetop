import {describe, expect, it} from "vitest";
import {ActorOutfitItems} from "../../../module/actors/character/ActorOutfitItems.js";
import {FakeActorBuilder} from "../../fakes/FakeActorBuilder.js";

function makeRawItem(overrides = {}) {
	return {
		_id:    overrides._id    ?? "item-1",
		type:   overrides.type   ?? "equipment",
		name:   overrides.name   ?? "Test",
		system: { equipmentType: overrides.equipmentType ?? "outfit", ...(overrides.system ?? {}) },
		flags:  { stonetop: { source: overrides.source ?? null, ...(overrides.stonetop ?? {}) } },
	};
}

function make(items = []) {
	return new ActorOutfitItems(new FakeActorBuilder().withItems(items).build());
}

describe("ActorOutfitItems.getAll", () => {
	it("returns outfit equipment items", () => {
		const aoi = make([makeRawItem()]);
		expect(aoi.getAll()).toHaveLength(1);
	});

	it("excludes non-outfit equipment items", () => {
		const aoi = make([makeRawItem({ equipmentType: "arcana" })]);
		expect(aoi.getAll()).toHaveLength(0);
	});

	it("excludes non-equipment items", () => {
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
	it("calls createEmbeddedDocuments with the given items", async () => {
		const actor = new FakeActorBuilder().withItems([]).build();
		const aoi = new ActorOutfitItems(actor);
		const data = [{ name: "X", type: "equipment" }];
		await aoi.create(data);
		expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith("Item", data);
	});

	it("is a no-op when items array is empty", async () => {
		const actor = new FakeActorBuilder().withItems([]).build();
		const aoi = new ActorOutfitItems(actor);
		await aoi.create([]);
		expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
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
		expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith("Item", ["a", "b"]);
	});

	it("is a no-op when no items match", async () => {
		const actor = new FakeActorBuilder().withItems([makeRawItem({source: "arcana:bow"})]).build();
		const aoi = new ActorOutfitItems(actor);
		await aoi.deleteBySource("arcana:sword");
		expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
	});
});

describe("ActorOutfitItems.deleteById", () => {
	it("deletes the single item with the given id", async () => {
		const actor = new FakeActorBuilder().withItems([]).build();
		const aoi = new ActorOutfitItems(actor);
		await aoi.deleteById("item-42");
		expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith("Item", ["item-42"]);
	});
});

describe("ActorOutfitItems.sync", () => {
	it("deletes existing items with the source then creates the new ones", async () => {
		const actor = new FakeActorBuilder().withItems([makeRawItem({_id: "old", source: "arcana:sword"})]).build();
		const aoi = new ActorOutfitItems(actor);
		const newData = [{ name: "New Sword", type: "equipment" }];
		await aoi.sync("arcana:sword", newData);
		expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith("Item", ["old"]);
		expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith("Item", newData);
	});

	it("skips create when new items array is empty", async () => {
		const actor = new FakeActorBuilder().withItems([makeRawItem({_id: "old", source: "arcana:sword"})]).build();
		const aoi = new ActorOutfitItems(actor);
		await aoi.sync("arcana:sword", []);
		expect(actor.deleteEmbeddedDocuments).toHaveBeenCalled();
		expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it("skips delete when no existing items match source", async () => {
		const actor = new FakeActorBuilder().withItems([]).build();
		const aoi = new ActorOutfitItems(actor);
		await aoi.sync("arcana:sword", [{ name: "Sword", type: "equipment" }]);
		expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		expect(actor.createEmbeddedDocuments).toHaveBeenCalled();
	});
});
