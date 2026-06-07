import { describe, expect, it } from "vitest";
import { migrateEmbeddedEquipment } from "../../src/migration/migrateCharacter.js";
import { FakeActorBuilder } from "../fakes/FakeActorBuilder.js";

function makeActor(items = []) {
	return new FakeActorBuilder().withItems(items).build();
}

const FRONT = { title: "Front", unlock: null, item: null, description: "desc" };
const BACK  = { title: "Back",  choices: null, moves: [], consequences: null, unlockAt: null, item: null, description: "" };

describe("migrateEmbeddedEquipment — skip non-arcana", () => {
	it("leaves equipment items without front/back alone", async () => {
		const actor = makeActor([
			{ _id: "e1", type: "equipment", name: "Old Widget", system: { slug: "widget" } },
		]);
		await migrateEmbeddedEquipment(actor);
		expect(actor.createdDocs).toHaveLength(0);
		expect(actor.deletedIds).toHaveLength(0);
	});

	it("leaves non-equipment items alone", async () => {
		const actor = makeActor([
			{ _id: "m1", type: "move", name: "Hack", system: { slug: "hack" } },
		]);
		await migrateEmbeddedEquipment(actor);
		expect(actor.createdDocs).toHaveLength(0);
	});
});

describe("migrateEmbeddedEquipment — arcana conversion", () => {
	it("creates a type:arcanum item from a type:equipment arcana item", async () => {
		const actor = makeActor([
			{
				_id: "eq1", type: "equipment", name: "Hungering Maw",
				img: "icons/maw.webp",
				system: { slug: "hungering-maw", major: true, front: FRONT, back: BACK, equipmentType: "arcanum" },
			},
		]);
		await migrateEmbeddedEquipment(actor);
		expect(actor.createdDocs).toHaveLength(1);
		const created = actor.createdDocs[0];
		expect(created.type).toBe("arcanum");
		expect(created.name).toBe("Hungering Maw");
		expect(created.img).toBe("icons/maw.webp");
		expect(created.system.slug).toBe("hungering-maw");
		expect(created.system.major).toBe(true);
		expect(created.system.front).toEqual(FRONT);
		expect(created.system.back).toEqual(BACK);
	});

	it("sets default mutable fields on new arcanum item", async () => {
		const actor = makeActor([
			{ _id: "eq1", type: "equipment", name: "Maw", system: { slug: "maw", front: FRONT, back: BACK } },
		]);
		await migrateEmbeddedEquipment(actor);
		const created = actor.createdDocs[0];
		expect(created.system.flipped).toBe(false);
		expect(created.system.unlockValues).toEqual({});
		expect(created.system.backChoiceValues).toEqual({});
	});

	it("deletes the old equipment item", async () => {
		const actor = makeActor([
			{ _id: "eq1", type: "equipment", name: "Maw", system: { slug: "maw", front: FRONT, back: BACK } },
		]);
		await migrateEmbeddedEquipment(actor);
		expect(actor.deletedIds).toContain("eq1");
	});

	it("handles multiple equipment arcana items", async () => {
		const actor = makeActor([
			{ _id: "eq1", type: "equipment", name: "Maw",  system: { slug: "maw",   front: FRONT, back: BACK } },
			{ _id: "eq2", type: "equipment", name: "Veil", system: { slug: "veil",  front: FRONT, back: BACK } },
		]);
		await migrateEmbeddedEquipment(actor);
		expect(actor.createdDocs).toHaveLength(2);
		expect(actor.deletedIds).toEqual(["eq1", "eq2"]);
	});

	it("defaults major to false if missing", async () => {
		const actor = makeActor([
			{ _id: "eq1", type: "equipment", name: "Maw", system: { slug: "maw", front: FRONT, back: BACK } },
		]);
		await migrateEmbeddedEquipment(actor);
		expect(actor.createdDocs[0].system.major).toBe(false);
	});
});
