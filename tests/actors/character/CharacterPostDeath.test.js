import { describe, it, expect, vi } from "vitest";
import { CharacterPostDeath } from "../../../src/actors/character/CharacterPostDeath.js";
import { CharacterInstincts } from "../../../src/actors/character/CharacterInstincts.js";
import { CharacterLore } from "../../../src/actors/character/CharacterLore.js";

function makeFlags(store = {}) {
	return {
		getFlag: (key) => store[key] ?? null,
		setFlag: vi.fn(async (key, val) => { store[key] = val; }),
	};
}


function makeInsertRepo(inserts = []) {
	return {
		getAll:     async () => inserts,
		findBySlug: async (slug) => inserts.find(i => i.slug === slug) ?? null,
	};
}

function makeFakeMoves() {
	return {
		addCategory:                 vi.fn(async () => {}),
		removeCategory:              vi.fn(async () => {}),
		getMoveSnapshotsForCategory: vi.fn(() => []),
	};
}

function makePostDeath({
	flags      = makeFlags(),
	insertRepo = makeInsertRepo([]),
	moves      = makeFakeMoves(),
} = {}) {
	return new CharacterPostDeath(
		flags,
		new CharacterInstincts(makeFlags()),
		new CharacterLore(makeFlags()),
		insertRepo,
		moves,
	);
}

describe("CharacterPostDeath", () => {
	it("activeSlug returns null when unset", () => {
		expect(makePostDeath().activeSlug).toBeNull();
	});

	it("setActiveSlug stores slug and activeSlug returns it", async () => {
		const flags = makeFlags();
		const pd = makePostDeath({ flags });
		await pd.setActiveSlug("revenant");
		expect(flags.setFlag).toHaveBeenCalledWith("slug", "revenant");
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
		const fakeMoves = makeFakeMoves();
		const pd = makePostDeath({ flags: makeFlags({ slug: "revenant" }), moves: fakeMoves });
		await pd.setInsert(null);
		expect(fakeMoves.removeCategory).toHaveBeenCalledWith("post-death-revenant");
		expect(pd.activeSlug).toBeNull();
	});

	it("does not call moves.removeCategory when no previous slug", async () => {
		const fakeMoves = makeFakeMoves();
		const pd = makePostDeath({ moves: fakeMoves });
		await pd.setInsert("revenant");
		expect(fakeMoves.removeCategory).not.toHaveBeenCalled();
	});

	it("calls removeCategory for old and addCategory for new when switching", async () => {
		const insertRepo = makeInsertRepo([
			{ slug: "revenant", name: "Revenant", img: null, description: "", instinct: null, lore: [] },
		]);
		const fakeMoves = makeFakeMoves();
		const pd = makePostDeath({ flags: makeFlags({ slug: "ghost" }), insertRepo, moves: fakeMoves });
		await pd.setInsert("revenant");
		expect(fakeMoves.removeCategory).toHaveBeenCalledWith("post-death-ghost");
		expect(fakeMoves.addCategory).toHaveBeenCalledWith("post-death-revenant", "Revenant", "revenant");
	});

	it("sets the active slug after a successful insert", async () => {
		const pd = makePostDeath();
		await pd.setInsert("revenant");
		expect(pd.activeSlug).toBe("revenant");
	});

	it("clears the active slug when called with null", async () => {
		const pd = makePostDeath({ flags: makeFlags({ slug: "revenant" }) });
		await pd.setInsert(null);
		expect(pd.activeSlug).toBeNull();
	});

	it("calls moves.addCategory with moveType, insert name, and slug", async () => {
		const insertRepo = makeInsertRepo([
			{ slug: "revenant", name: "Revenant", img: null, description: "", instinct: null, lore: [] },
		]);
		const fakeMoves = makeFakeMoves();
		const pd = makePostDeath({ insertRepo, moves: fakeMoves });
		await pd.setInsert("revenant");
		expect(fakeMoves.addCategory).toHaveBeenCalledWith("post-death-revenant", "Revenant", "revenant");
	});

	it("does not call addCategory when slug is null", async () => {
		const fakeMoves = makeFakeMoves();
		const pd = makePostDeath({ moves: fakeMoves });
		await pd.setInsert(null);
		expect(fakeMoves.addCategory).not.toHaveBeenCalled();
	});
});

describe("CharacterPostDeath.buildSnapshot", () => {
	it("activeInsert is null when no slug is set", async () => {
		const snap = await makePostDeath({ insertRepo: makeInsertRepo([]) }).buildSnapshot();
		expect(snap.activeInsert).toBeNull();
	});

	it("activeInsert.moves come from moves.getMoveSnapshotsForCategory", async () => {
		const insert = { slug: "revenant", name: "Revenant", img: null, description: "", instinct: null, lore: [] };
		const fakeMoves = makeFakeMoves();
		fakeMoves.getMoveSnapshotsForCategory.mockReturnValue([{ name: "Haunt" }]);
		const pd = makePostDeath({
			flags: makeFlags({ slug: "revenant" }),
			insertRepo: makeInsertRepo([insert]),
			moves: fakeMoves,
		});
		const snap = await pd.buildSnapshot();
		expect(snap.activeInsert.moves).toHaveLength(1);
		expect(snap.activeInsert.moves[0].name).toBe("Haunt");
		expect(fakeMoves.getMoveSnapshotsForCategory).toHaveBeenCalledWith("post-death-revenant");
	});

	it("activeInsert.moves is empty when getMoveSnapshotsForCategory returns []", async () => {
		const insert = { slug: "revenant", name: "Revenant", img: null, description: "", instinct: null, lore: [] };
		const snap = await makePostDeath({
			flags: makeFlags({ slug: "revenant" }),
			insertRepo: makeInsertRepo([insert]),
		}).buildSnapshot();
		expect(snap.activeInsert.moves).toHaveLength(0);
	});

	it("does not call moves.addCategory during buildSnapshot", async () => {
		const insert = { slug: "revenant", name: "Revenant", img: null, description: "", instinct: null, lore: [] };
		const fakeMoves = makeFakeMoves();
		const pd = makePostDeath({
			flags: makeFlags({ slug: "revenant" }),
			insertRepo: makeInsertRepo([insert]),
			moves: fakeMoves,
		});
		await pd.buildSnapshot();
		expect(fakeMoves.addCategory).not.toHaveBeenCalled();
	});
});
