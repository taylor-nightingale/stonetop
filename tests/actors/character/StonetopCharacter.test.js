import { describe, expect, it, vi } from "vitest";
import {TestCharacterBuilder} from "../../fakes/TestCharacterBuilder.js";
import {FakeActorBuilder} from "../../fakes/FakeActorBuilder.js";

// -- onDropItems --------------------------------------------------------------

describe("StonetopCharacter.onDropItems", () => {
	function makeChar() {
		return new TestCharacterBuilder(new FakeActorBuilder().build()).build();
	}

	it("returns arcanum items in others for Foundry to embed natively", async () => {
		const char = makeChar();
		const item = { type: "arcanum", system: { slug: "shell-game" } };

		const { anyAdded, others } = await char.onDropItems([item]);

		expect(others).toContain(item);
		expect(anyAdded).toBe(false);
	});

	it("routes non-arcanum move to onDropMove and returns anyAdded when truthy", async () => {
		const char = makeChar();
		const onDropMove = vi.spyOn(char, "onDropMove").mockResolvedValue(true);
		const item = { type: "move", system: { moveType: "playbook" } };

		const { anyAdded, others } = await char.onDropItems([item]);

		expect(onDropMove).toHaveBeenCalledWith(item);
		expect(anyAdded).toBe(true);
		expect(others).toHaveLength(0);
	});

	it("returns anyAdded=false when onDropMove returns falsy", async () => {
		const char = makeChar();
		vi.spyOn(char, "onDropMove").mockResolvedValue(false);
		const item = { type: "move", system: { moveType: "basic" } };

		const { anyAdded } = await char.onDropItems([item]);

		expect(anyAdded).toBe(false);
	});

	it("returns non-move non-follower items as others", async () => {
		const char = makeChar();
		const item = { type: "outfitItem", name: "Sword" };

		const { anyAdded, others } = await char.onDropItems([item]);

		expect(anyAdded).toBe(false);
		expect(others).toContain(item);
	});

	it("handles a mix: moves handled internally, arcana and others returned for embedding", async () => {
		const char = makeChar();
		vi.spyOn(char, "onDropMove").mockResolvedValue(false);
		const arcanum = { type: "arcanum", system: { slug: "eye" } };
		const move = { type: "move", system: { moveType: "basic" } };
		const other = { type: "outfitItem" };

		const { anyAdded, others } = await char.onDropItems([arcanum, move, other]);

		expect(anyAdded).toBe(false);
		expect(others).toContain(arcanum);
		expect(others).toContain(other);
	});

	it("deletes existing playbook item before returning new one in others", async () => {
		const existingPlaybook = { _id: "old-pb-id", type: "playbook", system: { slug: "the-blessed" } };
		const actor = new FakeActorBuilder().withItems([existingPlaybook]).build();
		const char = new TestCharacterBuilder(actor).build();
		const newPlaybook = { type: "playbook", system: { slug: "the-ranger" } };

		const { others } = await char.onDropItems([newPlaybook]);

		expect(actor.deletedIds).toContain("old-pb-id");
		expect(others).toContain(newPlaybook);
	});

	it("returns new playbook in others even when no existing playbook is present", async () => {
		const char = makeChar();
		const newPlaybook = { type: "playbook", system: { slug: "the-ranger" } };

		const { anyAdded, others } = await char.onDropItems([newPlaybook]);

		expect(anyAdded).toBe(false);
		expect(others).toContain(newPlaybook);
	});
});

// -- _onDeleteDescendantDocuments ---------------------------------------------

describe("StonetopCharacter._onDeleteDescendantDocuments", () => {
	it("removes possession items belonging to the deleted playbook", async () => {
		const possessionItem = {
			_id: "pouch-item-id", type: "possession",
			system: { slug: "sacred-pouch", playbookSlug: "the-blessed" },
		};
		const actor = new FakeActorBuilder().withItems([possessionItem]).build();
		const char = new TestCharacterBuilder(actor).build();

		await char._onDeleteDescendantDocuments([
			{ type: "playbook", system: { slug: "the-blessed" } },
		]);

		expect(actor.deletedIds).toContain("pouch-item-id");
	});

	it("does not remove possessions from a different playbook", async () => {
		const possessionItem = {
			_id: "pouch-item-id", type: "possession",
			system: { slug: "sacred-pouch", playbookSlug: "the-fox" },
		};
		const actor = new FakeActorBuilder().withItems([possessionItem]).build();
		const char = new TestCharacterBuilder(actor).build();

		await char._onDeleteDescendantDocuments([
			{ type: "playbook", system: { slug: "the-blessed" } },
		]);

		expect(actor.deletedIds).not.toContain("pouch-item-id");
	});

	it("is a no-op for non-playbook document types", async () => {
		const possessionItem = {
			_id: "pouch-item-id", type: "possession",
			system: { slug: "sacred-pouch", playbookSlug: "the-blessed" },
		};
		const actor = new FakeActorBuilder().withItems([possessionItem]).build();
		const char = new TestCharacterBuilder(actor).build();

		await char._onDeleteDescendantDocuments([
			{ type: "move", system: { slug: "some-move" } },
		]);

		expect(actor.deletedIds).toHaveLength(0);
	});
});

// -- selectBackground ---------------------------------------------------------

describe("StonetopCharacter.selectBackground", () => {
	it("calls background.selectBackground with the slug", async () => {
		const char = new TestCharacterBuilder(new FakeActorBuilder().build()).build();
		const selectBg = vi.spyOn(char.background, "selectBackground").mockResolvedValue();

		await char.selectBackground("vessel");

		expect(selectBg).toHaveBeenCalledWith("vessel");
	});

	it("passes the slug through to background.selectBackground", async () => {
		const char = new TestCharacterBuilder(new FakeActorBuilder().build()).build();
		const selectBg = vi.spyOn(char.background, "selectBackground").mockResolvedValue();

		await char.selectBackground("initiate");

		expect(selectBg).toHaveBeenCalledWith("initiate");
	});
});


