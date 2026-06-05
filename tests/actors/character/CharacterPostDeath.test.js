import { describe, it, expect } from "vitest";
import { CharacterPostDeath } from "../../../src/actors/character/CharacterPostDeath.js";
import { CharacterInstincts } from "../../../src/actors/character/CharacterInstincts.js";
import { CharacterLore } from "../../../src/actors/character/CharacterLore.js";
import { ChoiceGroupController } from "../../../src/actors/character/ChoiceGroupController.js";
import { FakeActorBuilder } from "../../fakes/FakeActorBuilder.js";
import { FakeMoves } from "../../fakes/FakeMoves.js";

function makeInsertRepo(inserts = []) {
	return {
		getAll:     async () => inserts,
		findBySlug: async (slug) => inserts.find(i => i.slug === slug) ?? null,
	};
}

function makePostDeath({ initialSlug = null, insertRepo = makeInsertRepo([]), moves = new FakeMoves() } = {}) {
	const actor = new FakeActorBuilder().build();
	if (initialSlug) actor.system.postDeath = { insert: initialSlug };
	const ctrl = ChoiceGroupController.forActorSection(actor, "postDeathChoices");
	return new CharacterPostDeath(
		actor,
		new CharacterInstincts(actor, ctrl, "postDeathInstinct"),
		new CharacterLore(actor, "postDeathLore"),
		insertRepo,
		moves,
	);
}

describe("CharacterPostDeath", () => {
	it("activeSlug returns null when unset", () => {
		expect(makePostDeath().activeSlug).toBeNull();
	});

	it("setActiveSlug stores slug and activeSlug returns it", async () => {
		const pd = makePostDeath();
		await pd.setActiveSlug("revenant");
		expect(pd.activeSlug).toBe("revenant");
	});

	it("instinct returns the CharacterInstincts instance", () => {
		expect(makePostDeath().instinct).toBeInstanceOf(CharacterInstincts);
	});

	it("lore returns the CharacterLore instance", () => {
		expect(makePostDeath().lore).toBeInstanceOf(CharacterLore);
	});
});

describe("CharacterPostDeath.setInsert", () => {
	it("calls moves.removeCategory for the previous insert", async () => {
		const moves = new FakeMoves();
		const pd = makePostDeath({ initialSlug: "revenant", moves });
		await pd.setInsert(null);
		expect(moves.removedCategories).toContain("post-death-revenant");
		expect(pd.activeSlug).toBeNull();
	});

	it("does not call moves.removeCategory when no previous slug", async () => {
		const moves = new FakeMoves();
		const pd = makePostDeath({ moves });
		await pd.setInsert("revenant");
		expect(moves.removedCategories).toHaveLength(0);
	});

	it("calls removeCategory for old and addCategory for new when switching", async () => {
		const insertRepo = makeInsertRepo([
			{ slug: "revenant", name: "Revenant", img: null, description: "", instinct: null, lore: [] },
		]);
		const moves = new FakeMoves();
		const pd = makePostDeath({ initialSlug: "ghost", insertRepo, moves });
		await pd.setInsert("revenant");
		expect(moves.removedCategories).toContain("post-death-ghost");
		expect(moves.addedCategories).toContainEqual({ type: "post-death-revenant", name: "Revenant", slug: "revenant" });
	});

	it("sets the active slug after a successful insert", async () => {
		const pd = makePostDeath();
		await pd.setInsert("revenant");
		expect(pd.activeSlug).toBe("revenant");
	});

	it("clears the active slug when called with null", async () => {
		const pd = makePostDeath({ initialSlug: "revenant" });
		await pd.setInsert(null);
		expect(pd.activeSlug).toBeNull();
	});

	it("calls moves.addCategory with moveType, insert name, and slug", async () => {
		const insertRepo = makeInsertRepo([
			{ slug: "revenant", name: "Revenant", img: null, description: "", instinct: null, lore: [] },
		]);
		const moves = new FakeMoves();
		const pd = makePostDeath({ insertRepo, moves });
		await pd.setInsert("revenant");
		expect(moves.addedCategories).toContainEqual({ type: "post-death-revenant", name: "Revenant", slug: "revenant" });
	});

	it("does not call addCategory when slug is null", async () => {
		const moves = new FakeMoves();
		const pd = makePostDeath({ moves });
		await pd.setInsert(null);
		expect(moves.addedCategories).toHaveLength(0);
	});
});

describe("CharacterPostDeath.buildSnapshot", () => {
	it("activeInsert is null when no slug is set", async () => {
		const snap = await makePostDeath({ insertRepo: makeInsertRepo([]) }).buildSnapshot();
		expect(snap.activeInsert).toBeNull();
	});

	it("activeInsert.moves come from moves.getMoveSnapshotsForCategory", async () => {
		const insert = { slug: "revenant", name: "Revenant", img: null, description: "", instinct: null, lore: [] };
		const moves = new FakeMoves();
		moves.setSnapshotsForCategory("post-death-revenant", [{ name: "Haunt" }]);
		const pd = makePostDeath({
			initialSlug: "revenant",
			insertRepo: makeInsertRepo([insert]),
			moves,
		});
		const snap = await pd.buildSnapshot();
		expect(snap.activeInsert.moves).toHaveLength(1);
		expect(snap.activeInsert.moves[0].name).toBe("Haunt");
	});

	it("activeInsert.moves is empty when getMoveSnapshotsForCategory returns []", async () => {
		const insert = { slug: "revenant", name: "Revenant", img: null, description: "", instinct: null, lore: [] };
		const snap = await makePostDeath({
			initialSlug: "revenant",
			insertRepo: makeInsertRepo([insert]),
		}).buildSnapshot();
		expect(snap.activeInsert.moves).toHaveLength(0);
	});

	it("does not call moves.addCategory during buildSnapshot", async () => {
		const insert = { slug: "revenant", name: "Revenant", img: null, description: "", instinct: null, lore: [] };
		const moves = new FakeMoves();
		const pd = makePostDeath({
			initialSlug: "revenant",
			insertRepo: makeInsertRepo([insert]),
			moves,
		});
		await pd.buildSnapshot();
		expect(moves.addedCategories).toHaveLength(0);
	});
});
