import { describe, expect, it, vi } from "vitest";
import { TestCharacterBuilder } from "../../fakes/TestCharacterBuilder.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";

describe("StonetopCharacter.applyDroppedItems", () => {
	it("embeds a new arcanum", async () => {
		const actor = new FakeCharacterActorBuilder().build();
		const char = new TestCharacterBuilder(actor).build();
		const arcanum = { type: "arcanum", system: { slug: "the-eye" } };

		const toEmbed = await char.applyDroppedItems([arcanum]);

		expect(toEmbed).toContain(arcanum);
		expect(actor.createdDocs.map(d => d.system?.slug)).toContain("the-eye");
	});

	it("skips an already-owned arcanum", async () => {
		const actor = new FakeCharacterActorBuilder()
			.withItems([{ _id: "a1", type: "arcanum", system: { slug: "the-eye" } }])
			.build();
		const char = new TestCharacterBuilder(actor).build();

		const toEmbed = await char.applyDroppedItems([{ type: "arcanum", system: { slug: "the-eye" } }]);

		expect(toEmbed).toHaveLength(0);
		expect(actor.createdDocs).toHaveLength(0);
	});

	it("embeds pass-through items and absorbs moves", async () => {
		const actor = new FakeCharacterActorBuilder().build();
		const char = new TestCharacterBuilder(actor).build();
		vi.spyOn(char, "onDropMove").mockResolvedValue(true);
		const outfit = { type: "outfitItem", name: "Sword" };
		const move = { type: "move", system: { moveType: "basic" } };

		const toEmbed = await char.applyDroppedItems([outfit, move]);

		expect(toEmbed).toEqual([outfit]);
		expect(actor.createdDocs.map(d => d.name)).toEqual(["Sword"]);
	});

	it("does not touch the actor when everything was absorbed", async () => {
		const actor = new FakeCharacterActorBuilder().build();
		const char = new TestCharacterBuilder(actor).build();
		vi.spyOn(char, "onDropMove").mockResolvedValue(true);

		const toEmbed = await char.applyDroppedItems([{ type: "move", system: {} }]);

		expect(toEmbed).toHaveLength(0);
		expect(actor.createdDocs).toHaveLength(0);
	});
});

describe("StonetopCharacter.applyPlaybookBySlug", () => {
	const playbookData = { type: "playbook", name: "The Blessed", system: { slug: "the-blessed" } };

	it("embeds the playbook item found by slug", async () => {
		const actor = new FakeCharacterActorBuilder().build();
		const char = new TestCharacterBuilder(actor).addPlaybookItemData(playbookData).build();

		await char.applyPlaybookBySlug("the-blessed");

		expect(actor.createdDocs.map(d => d.system?.slug)).toContain("the-blessed");
	});

	it("replaces an existing playbook item", async () => {
		const actor = new FakeCharacterActorBuilder()
			.withItems([{ _id: "old-pb", type: "playbook", system: { slug: "the-fox" } }])
			.build();
		const char = new TestCharacterBuilder(actor).addPlaybookItemData(playbookData).build();

		await char.applyPlaybookBySlug("the-blessed");

		expect(actor.deletedIds).toContain("old-pb");
		expect(actor.createdDocs.map(d => d.system?.slug)).toContain("the-blessed");
	});

	it("does nothing for an unknown slug", async () => {
		const actor = new FakeCharacterActorBuilder().build();
		const char = new TestCharacterBuilder(actor).build();

		await char.applyPlaybookBySlug("nope");

		expect(actor.createdDocs).toHaveLength(0);
	});

	it("does nothing for a blank slug", async () => {
		const actor = new FakeCharacterActorBuilder().build();
		const char = new TestCharacterBuilder(actor).build();

		await char.applyPlaybookBySlug("");

		expect(actor.createdDocs).toHaveLength(0);
	});
});
