import {describe, expect, it} from "vitest";
import {ActorOutfitItems} from "../../../src/actors/character/ActorOutfitItems.js";
import {FakeCharacterActorBuilder} from "../../fakes/FakeCharacterActorBuilder.js";

// Provenance is the grant stamp every granted item carries, not a field of its own.
function makeRawItem(overrides = {}) {
	const name = overrides.name ?? "Test";
	const slug = overrides.system?.slug ?? name;
	return {
		_id:    overrides._id  ?? "item-1",
		type:   overrides.type ?? "outfitItem",
		name,
		system: { ...(overrides.system ?? {}) },
		// Gear answers to its own source ("outfit:possession:x"), so clearing a container's items can't
		// touch the followers or moves that container also granted.
		...(overrides.source
			? { flags: { stonetop: { grant: { source: `outfit:${overrides.source}`, key: `outfitItem:${slug}` } } } }
			: {}),
	};
}

function make(items = []) {
	return new ActorOutfitItems(new FakeCharacterActorBuilder().withItems(items).build());
}

describe("ActorOutfitItems.getAll", () => {
	it("returns outfitItem items", () => {
		const aoi = make([makeRawItem()]);
		expect(aoi.getAll()).toHaveLength(1);
	});

	it("excludes non-outfitItem items", () => {
		const aoi = make([makeRawItem({ type: "arcanum" })]);
		expect(aoi.getAll()).toHaveLength(0);
	});

	it("excludes move items", () => {
		const aoi = make([makeRawItem({ type: "move" })]);
		expect(aoi.getAll()).toHaveLength(0);
	});

	it("returns empty array when actor has no items", () => {
		expect(new ActorOutfitItems(new FakeCharacterActorBuilder().withItems([]).build()).getAll()).toHaveLength(0);
	});
});

describe("ActorOutfitItems.create", () => {
	it("creates the given items on the actor", async () => {
		const actor = new FakeCharacterActorBuilder().withItems([]).build();
		const aoi = new ActorOutfitItems(actor);
		await aoi.create([{ name: "X", type: "outfitItem" }]);
		expect(actor.createdDocs).toHaveLength(1);
	});

	it("is a no-op when items array is empty", async () => {
		const actor = new FakeCharacterActorBuilder().withItems([]).build();
		const aoi = new ActorOutfitItems(actor);
		await aoi.create([]);
		expect(actor.createdDocs).toHaveLength(0);
	});
});

describe("ActorOutfitItems.deleteBySources", () => {
	it("deletes all items with the matching source", async () => {
		const actor = new FakeCharacterActorBuilder().withItems([
			makeRawItem({_id: "a", source: "arcana:sword"}),
			makeRawItem({_id: "b", source: "arcana:sword"}),
		]).build();
		const aoi = new ActorOutfitItems(actor);
		await aoi.deleteBySources(["arcana:sword"]);
		expect(actor.deletedIds).toEqual(["a", "b"]);
	});

	it("is a no-op when no items match", async () => {
		const actor = new FakeCharacterActorBuilder().withItems([makeRawItem({source: "arcana:bow"})]).build();
		const aoi = new ActorOutfitItems(actor);
		await aoi.deleteBySources(["arcana:sword"]);
		expect(actor.deletedIds).toHaveLength(0);
	});
});

describe("ActorOutfitItems.deleteById", () => {
	it("deletes the single item with the given id", async () => {
		const actor = new FakeCharacterActorBuilder().withItems([]).build();
		const aoi = new ActorOutfitItems(actor);
		await aoi.deleteById("item-42");
		expect(actor.deletedIds).toEqual(["item-42"]);
	});
});

describe("ActorOutfitItems.sync", () => {
	it("deletes existing items with the source then creates the new ones", async () => {
		const actor = new FakeCharacterActorBuilder().withItems([makeRawItem({_id: "old", source: "arcana:sword"})]).build();
		const aoi = new ActorOutfitItems(actor);
		await aoi.sync("arcana:sword", [{ name: "New Sword", type: "outfitItem" }]);
		expect(actor.deletedIds).toEqual(["old"]);
		expect(actor.createdDocs).toHaveLength(1);
	});

	// Nothing to grant is not an instruction to delete — ContainerOutfitSync calls deleteBySource for
	// that, so an empty list here only ever means the container's gear hasn't resolved.
	it("does nothing when the new items array is empty", async () => {
		const actor = new FakeCharacterActorBuilder().withItems([makeRawItem({_id: "old", source: "arcana:sword"})]).build();
		const aoi = new ActorOutfitItems(actor);
		await aoi.sync("arcana:sword", []);
		expect(actor.deletedIds).toEqual([]);
		expect(actor.createdDocs).toHaveLength(0);
	});

	it("skips delete when no existing items match source", async () => {
		const actor = new FakeCharacterActorBuilder().withItems([]).build();
		const aoi = new ActorOutfitItems(actor);
		await aoi.sync("arcana:sword", [{ name: "Sword", type: "outfitItem" }]);
		expect(actor.deletedIds).toHaveLength(0);
		expect(actor.createdDocs).toHaveLength(1);
	});
});
