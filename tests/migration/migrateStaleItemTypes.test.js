import { describe, expect, it } from "vitest";
import { migrateStaleItemTypes } from "../../src/migration/migrateCharacter.js";
import { FakeActorBuilder } from "../fakes/FakeActorBuilder.js";

function makeActor(items = []) {
	return new FakeActorBuilder().withItems(items).build();
}

function makeItem(id, type) {
	return { _id: id, type, name: id, system: {} };
}

describe("migrateStaleItemTypes", () => {
	it("deletes items with the legacy 'Item' base type", async () => {
		const actor = makeActor([makeItem("stale-1", "Item"), makeItem("stale-2", "Item")]);
		await migrateStaleItemTypes(actor);
		expect(actor.deletedIds).toContain("stale-1");
		expect(actor.deletedIds).toContain("stale-2");
	});

	it("does not delete items with recognised types", async () => {
		const actor = makeActor([
			makeItem("m1", "move"),
			makeItem("p1", "playbook"),
			makeItem("pos1", "possession"),
			makeItem("arc1", "arcanum"),
			makeItem("npc1", "npc"),
			makeItem("ins1", "insert"),
		]);
		await migrateStaleItemTypes(actor);
		expect(actor.deletedIds).toHaveLength(0);
	});

	it("deletes only stale items when mixed with valid types", async () => {
		const actor = makeActor([
			makeItem("good", "move"),
			makeItem("bad", "Item"),
		]);
		await migrateStaleItemTypes(actor);
		expect(actor.deletedIds).toContain("bad");
		expect(actor.deletedIds).not.toContain("good");
	});

	it("is a no-op when there are no items", async () => {
		const actor = makeActor([]);
		await migrateStaleItemTypes(actor);
		expect(actor.deletedIds).toHaveLength(0);
	});
});
