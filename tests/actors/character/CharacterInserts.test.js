import { describe, it, expect } from "vitest";
import { CharacterInserts } from "../../../src/actors/character/CharacterInserts.js";
import { ChoiceGroupFactory } from "../../../src/actors/character/ChoiceGroupFactory.js";
import { FakeActorBuilder } from "../../fakes/FakeActorBuilder.js";
import { FakeMoves } from "../../fakes/FakeMoves.js";
import { TestInsertItemBuilder } from "../../fakes/TestInsertItemBuilder.js";
import { InsertSnapshot } from "../../../src/model/snapshot/character/InsertSnapshot.js";
import { ChoiceGroup } from "../../../src/model/snapshot/character/ChoiceGroup.js";

const REVENANT = new TestInsertItemBuilder().withSlug("revenant").withName("Revenant").build();
const GHOST    = new TestInsertItemBuilder().withId("insert-item-2").withSlug("ghost").withName("Ghost").build();

function makeInserts({ items = [], moves = new FakeMoves() } = {}) {
	const actor = new FakeActorBuilder().withItems(items).build();
	return { actor, inserts: new CharacterInserts(actor, new ChoiceGroupFactory(actor), moves) };
}

// ── onInsertDropped ───────────────────────────────────────────────────────────

describe("CharacterInserts.onInsertDropped", () => {
	it("adds move category with insert-{slug} key, insert name, and slug", async () => {
		const moves = new FakeMoves();
		const { inserts } = makeInserts({ moves });
		await inserts.onInsertDropped(REVENANT);
		expect(moves.addedCategories).toContainEqual({
			type: "insert-revenant", name: "Revenant", slug: "revenant",
		});
	});

	it("allows multiple inserts — does not remove existing ones", async () => {
		const moves = new FakeMoves();
		const { inserts } = makeInserts({ items: [GHOST], moves });
		await inserts.onInsertDropped(REVENANT);
		expect(moves.removedCategories).toHaveLength(0);
	});
});

// ── removeInsert ──────────────────────────────────────────────────────────────

describe("CharacterInserts.removeInsert", () => {
	it("removes the move category for the specified insert item", async () => {
		const moves = new FakeMoves();
		const { inserts } = makeInserts({ items: [REVENANT], moves });
		await inserts.removeInsert(REVENANT._id);
		expect(moves.removedCategories).toContain("insert-revenant");
	});

	it("deletes the specified embedded insert item", async () => {
		const { actor, inserts } = makeInserts({ items: [REVENANT] });
		await inserts.removeInsert(REVENANT._id);
		expect(actor.deletedIds).toContain(REVENANT._id);
	});

	it("removes only the specified item when multiple inserts exist", async () => {
		const { actor, inserts } = makeInserts({ items: [REVENANT, GHOST] });
		await inserts.removeInsert(GHOST._id);
		expect(actor.deletedIds).toContain(GHOST._id);
		expect(actor.deletedIds).not.toContain(REVENANT._id);
	});

	it("does nothing when item ID not found", async () => {
		const moves = new FakeMoves();
		const { actor, inserts } = makeInserts({ moves });
		await inserts.removeInsert("nonexistent");
		expect(moves.removedCategories).toHaveLength(0);
		expect(actor.deletedIds).toHaveLength(0);
	});
});

// ── onInsertRemoved ───────────────────────────────────────────────────────────

describe("CharacterInserts.onInsertRemoved", () => {
	it("removes move category for slug", async () => {
		const moves = new FakeMoves();
		const { inserts } = makeInserts({ moves });
		await inserts.onInsertRemoved("revenant");
		expect(moves.removedCategories).toContain("insert-revenant");
	});

	it("does nothing when slug is null", async () => {
		const moves = new FakeMoves();
		const { inserts } = makeInserts({ moves });
		await inserts.onInsertRemoved(null);
		expect(moves.removedCategories).toHaveLength(0);
	});
});

// ── buildSnapshot ─────────────────────────────────────────────────────────────

describe("CharacterInserts.buildSnapshot", () => {
	it("returns empty array when no insert items are embedded", async () => {
		const { inserts } = makeInserts();
		expect(await inserts.buildSnapshot()).toHaveLength(0);
	});

	it("returns one InsertSnapshot per embedded insert", async () => {
		const { inserts } = makeInserts({ items: [REVENANT, GHOST] });
		const snaps = await inserts.buildSnapshot();
		expect(snaps).toHaveLength(2);
		expect(snaps[0]).toBeInstanceOf(InsertSnapshot);
		expect(snaps[1]).toBeInstanceOf(InsertSnapshot);
	});

	it("snapshot.id is the item _id", async () => {
		const { inserts } = makeInserts({ items: [REVENANT] });
		expect((await inserts.buildSnapshot())[0].id).toBe(REVENANT._id);
	});

	it("snapshot.slug comes from the embedded item", async () => {
		const { inserts } = makeInserts({ items: [REVENANT] });
		expect((await inserts.buildSnapshot())[0].slug).toBe("revenant");
	});

	it("snapshot.name comes from the embedded item", async () => {
		const { inserts } = makeInserts({ items: [REVENANT] });
		expect((await inserts.buildSnapshot())[0].name).toBe("Revenant");
	});

	it("snapshot.description comes from item.system.description", async () => {
		const item = new TestInsertItemBuilder().withDescription("<p>When you die…</p>").build();
		const { inserts } = makeInserts({ items: [item] });
		expect((await inserts.buildSnapshot())[0].description).toBe("<p>When you die…</p>");
	});

	it("snapshot.instinctGroup is a ChoiceGroup built from item.system.instinct", async () => {
		const item = new TestInsertItemBuilder()
			.withInstinct({ slug: "instinct", list: [] })
			.withChoices([{ slug: "terrible-purpose", list: [] }])
			.build();
		const { inserts } = makeInserts({ items: [item] });
		const snap = (await inserts.buildSnapshot())[0];
		expect(snap.instinctGroup).toBeInstanceOf(ChoiceGroup);
		expect(snap.instinctGroup.slug).toBe("instinct");
	});

	it("snapshot.choices contains non-instinct ChoiceGroups", async () => {
		const item = new TestInsertItemBuilder()
			.withInstinct({ slug: "instinct", list: [] })
			.withChoices([{ slug: "terrible-purpose", list: [] }])
			.build();
		const { inserts } = makeInserts({ items: [item] });
		const snap = (await inserts.buildSnapshot())[0];
		expect(snap.choices).toHaveLength(1);
		expect(snap.choices[0]).toBeInstanceOf(ChoiceGroup);
	});

	it("snapshot.choices reflects stored choiceValues", async () => {
		const item = new TestInsertItemBuilder()
			.withChoices([{
				slug: "terrible-purpose",
				list: [{ type: "entry", slug: "longing", content: { title: null, text: "Longing" }, track: { max: 1 } }],
			}])
			.withChoiceValues({ "terrible-purpose": { longing: 1 } })
			.build();
		const { inserts } = makeInserts({ items: [item] });
		const snap = (await inserts.buildSnapshot())[0];
		const row  = snap.choices[0].list[0];
		expect(row.track.checks[0]).toBe(true);
	});

	it("snapshot.moves comes from moves.getMoveSnapshotsForCategory", async () => {
		const moves = new FakeMoves();
		moves.setSnapshotsForCategory("insert-revenant", [{ name: "Haunt" }]);
		const { inserts } = makeInserts({ items: [REVENANT], moves });
		const snap = (await inserts.buildSnapshot())[0];
		expect(snap.moves).toHaveLength(1);
		expect(snap.moves[0].name).toBe("Haunt");
	});

	it("does not call moves.addCategory during buildSnapshot", async () => {
		const moves = new FakeMoves();
		const { inserts } = makeInserts({ items: [REVENANT], moves });
		await inserts.buildSnapshot();
		expect(moves.addedCategories).toHaveLength(0);
	});
});

// ── setCount / selectOption / setText ─────────────────────────────────────────

describe("CharacterInserts interactions", () => {
	it("setCount persists value on the insert item choiceValues", async () => {
		const item = new TestInsertItemBuilder()
			.withChoices([{
				slug: "terrible-purpose",
				list: [{ type: "entry", slug: "longing", content: { title: null, text: "" }, track: { max: 1 } }],
			}])
			.build();
		const { actor, inserts } = makeInserts({ items: [item] });
		await inserts.setCount(item._id, "terrible-purpose", "longing", 1);
		const snap = (await inserts.buildSnapshot())[0];
		expect(snap.choices[0].list[0].track.checks[0]).toBe(true);
	});

	it("selectOption persists pick selection on the insert item", async () => {
		const item = new TestInsertItemBuilder()
			.withInstinct({
				slug: "instinct",
				list: [{ type: "pick", pickCount: 1, options: [
					{ slug: "denial", text: "Denial", description: "To refuse." },
					{ slug: "obsession", text: "Obsession", description: "To pursue." },
				]}],
			})
			.build();
		const { inserts } = makeInserts({ items: [item] });
		await inserts.selectOption(item._id, "instinct", "denial", "denial,obsession");
		const snap = (await inserts.buildSnapshot())[0];
		expect(snap.instinctGroup.list[0].options.find(o => o.slug === "denial").checked).toBe(true);
		expect(snap.instinctGroup.list[0].options.find(o => o.slug === "obsession").checked).toBe(false);
	});
});
