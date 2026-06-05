import { describe, it, expect } from "vitest";
import { CharacterPostDeath } from "../../../src/actors/character/CharacterPostDeath.js";
import { CharacterInstincts } from "../../../src/actors/character/CharacterInstincts.js";
import { CharacterLore } from "../../../src/actors/character/CharacterLore.js";
import { ChoiceGroupController } from "../../../src/actors/character/ChoiceGroupController.js";
import { FakeActorBuilder } from "../../fakes/FakeActorBuilder.js";
import { FakeMoves } from "../../fakes/FakeMoves.js";
import { TestInsertItemBuilder } from "../../fakes/TestInsertItemBuilder.js";
import { PostDeathInsertSnapshot } from "../../../src/model/snapshot/character/PostDeathInsertSnapshot.js";

function makePostDeath({ items = [], moves = new FakeMoves() } = {}) {
	const actor = new FakeActorBuilder().withItems(items).build();
	const ctrl = ChoiceGroupController.forActorSection(actor, "postDeathChoices");
	return {
		actor,
		pd: new CharacterPostDeath(
			actor,
			new CharacterInstincts(actor, ctrl, "postDeathInstinct"),
			new CharacterLore(actor, "postDeathLore"),
			moves,
		),
	};
}

const REVENANT = new TestInsertItemBuilder().withSlug("revenant").withName("Revenant").build();
const GHOST    = new TestInsertItemBuilder().withId("insert-item-2").withSlug("ghost").withName("Ghost").build();

// ── Basic accessors ───────────────────────────────────────────────────────────

describe("CharacterPostDeath", () => {
	it("instinct returns the CharacterInstincts instance", () => {
		expect(makePostDeath().pd.instinct).toBeInstanceOf(CharacterInstincts);
	});

	it("lore returns the CharacterLore instance", () => {
		expect(makePostDeath().pd.lore).toBeInstanceOf(CharacterLore);
	});
});

// ── onInsertDropped ───────────────────────────────────────────────────────────

describe("CharacterPostDeath.onInsertDropped", () => {
	it("adds move category with post-death-{slug} type, insert name, and slug", async () => {
		const moves = new FakeMoves();
		const { pd } = makePostDeath({ moves });
		await pd.onInsertDropped(REVENANT);
		expect(moves.addedCategories).toContainEqual({
			type: "post-death-revenant", name: "Revenant", slug: "revenant",
		});
	});

	it("does not error when no existing insert is present", async () => {
		const { pd } = makePostDeath();
		await expect(pd.onInsertDropped(REVENANT)).resolves.not.toThrow();
	});

	it("removes old move category when an existing insert is replaced", async () => {
		const moves = new FakeMoves();
		const { pd } = makePostDeath({ items: [GHOST], moves });
		await pd.onInsertDropped(REVENANT);
		expect(moves.removedCategories).toContain("post-death-ghost");
	});

	it("deletes the old embedded item when an existing insert is replaced", async () => {
		const { actor, pd } = makePostDeath({ items: [GHOST] });
		await pd.onInsertDropped(REVENANT);
		expect(actor.deletedIds).toContain(GHOST._id);
	});

	it("adds move category for the new insert after replacing an old one", async () => {
		const moves = new FakeMoves();
		const { pd } = makePostDeath({ items: [GHOST], moves });
		await pd.onInsertDropped(REVENANT);
		expect(moves.addedCategories).toContainEqual({
			type: "post-death-revenant", name: "Revenant", slug: "revenant",
		});
	});
});

// ── removeInsert ─────────────────────────────────────────────────────────────

describe("CharacterPostDeath.removeInsert", () => {
	it("removes the move category for the embedded insert", async () => {
		const moves = new FakeMoves();
		const { pd } = makePostDeath({ items: [REVENANT], moves });
		await pd.removeInsert();
		expect(moves.removedCategories).toContain("post-death-revenant");
	});

	it("deletes the embedded insert item", async () => {
		const { actor, pd } = makePostDeath({ items: [REVENANT] });
		await pd.removeInsert();
		expect(actor.deletedIds).toContain(REVENANT._id);
	});

	it("does nothing when no insert is embedded", async () => {
		const moves = new FakeMoves();
		const { actor, pd } = makePostDeath({ moves });
		await pd.removeInsert();
		expect(moves.removedCategories).toHaveLength(0);
		expect(actor.deletedIds).toHaveLength(0);
	});
});

// ── onInsertRemoved ───────────────────────────────────────────────────────────

describe("CharacterPostDeath.onInsertRemoved", () => {
	it("removes move category for slug", async () => {
		const moves = new FakeMoves();
		const { pd } = makePostDeath({ moves });
		await pd.onInsertRemoved("revenant");
		expect(moves.removedCategories).toContain("post-death-revenant");
	});

	it("does nothing when slug is null", async () => {
		const moves = new FakeMoves();
		const { pd } = makePostDeath({ moves });
		await pd.onInsertRemoved(null);
		expect(moves.removedCategories).toHaveLength(0);
	});
});

// ── buildSnapshot ─────────────────────────────────────────────────────────────

describe("CharacterPostDeath.buildSnapshot", () => {
	it("returns null when no insert item is embedded", async () => {
		const { pd } = makePostDeath();
		expect(await pd.buildSnapshot()).toBeNull();
	});

	it("returns a PostDeathInsertSnapshot when an insert is embedded", async () => {
		const { pd } = makePostDeath({ items: [REVENANT] });
		expect(await pd.buildSnapshot()).toBeInstanceOf(PostDeathInsertSnapshot);
	});

	it("snapshot.slug comes from the embedded item", async () => {
		const { pd } = makePostDeath({ items: [REVENANT] });
		expect((await pd.buildSnapshot()).slug).toBe("revenant");
	});

	it("snapshot.name comes from the embedded item", async () => {
		const { pd } = makePostDeath({ items: [REVENANT] });
		expect((await pd.buildSnapshot()).name).toBe("Revenant");
	});

	it("snapshot.description comes from item.system.description", async () => {
		const item = new TestInsertItemBuilder().withDescription("<p>When you die…</p>").build();
		const { pd } = makePostDeath({ items: [item] });
		expect((await pd.buildSnapshot()).description).toBe("<p>When you die…</p>");
	});

	it("snapshot.moves comes from moves.getMoveSnapshotsForCategory", async () => {
		const moves = new FakeMoves();
		moves.setSnapshotsForCategory("post-death-revenant", [{ name: "Haunt" }]);
		const { pd } = makePostDeath({ items: [REVENANT], moves });
		expect((await pd.buildSnapshot()).moves).toHaveLength(1);
		expect((await pd.buildSnapshot()).moves[0].name).toBe("Haunt");
	});

	it("snapshot.moves is empty when no move snapshots registered", async () => {
		const { pd } = makePostDeath({ items: [REVENANT] });
		expect((await pd.buildSnapshot()).moves).toHaveLength(0);
	});

	it("does not call moves.addCategory during buildSnapshot", async () => {
		const moves = new FakeMoves();
		const { pd } = makePostDeath({ items: [REVENANT], moves });
		await pd.buildSnapshot();
		expect(moves.addedCategories).toHaveLength(0);
	});
});
