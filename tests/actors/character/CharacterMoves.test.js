import { describe, expect, it, vi } from "vitest";
import { CharacterMoves } from "../../../module/actors/character/CharacterMoves.js";
import { FakeMoveRepository } from "../../fakes/FakeMoveRepository.js";
import {
	MoveSnapshot,
	Movelist,
	MoveCategorySnapshot,
	ValueMax,
} from "../../../module/model/snapshot/character/CharacterSnapshot.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFlags(store = {}) {
	return {
		getFlag: (key) => store[key] ?? null,
		setFlag: vi.fn(async (key, val) => { store[key] = val; }),
	};
}

function makeActor(level = 1) {
	return {
		system: { attributes: { level: { value: level } } },
		createEmbeddedDocuments: vi.fn(async (_, docs) =>
			docs.map((d, i) => ({ _id: `created-${i}`, name: d.name }))
		),
		deleteEmbeddedDocuments: vi.fn(async () => []),
	};
}

function makeMoves({
	repo  = new FakeMoveRepository(),
	flags = makeFlags(),
	actor = makeActor(),
} = {}) {
	return new CharacterMoves(repo, flags, actor);
}

function makePlaybookData(overrides = {}) {
	return {
		slug: "the-heavy",
		name: "The Heavy",
		startingMovesNote: null,
		backgrounds: [],
		...overrides,
	};
}

function makeFlagCategory(key, overrides = {}) {
	return {
		key,
		label: overrides.label ?? key,
		renderStyle: overrides.renderStyle ?? "standard",
		allowAdditional: overrides.allowAdditional ?? false,
		note: overrides.note ?? null,
		moves: overrides.moves ?? [],
	};
}

function makeFlagMove(name, overrides = {}) {
	return {
		name,
		compendiumId: overrides.compendiumId ?? null,
		rollType: overrides.rollType ?? null,
		description: overrides.description ?? "",
		isStarting: overrides.isStarting ?? false,
		requirement: overrides.requirement ?? null,
		selection: overrides.selection ?? { max: 1, value: 0 },
		ownedIds: overrides.ownedIds ?? [],
		resource: overrides.resource ?? null,
	};
}

// ── sortPlaybookMoves ─────────────────────────────────────────────────────────

function mv(name, { requires = null, minLevel = null } = {}) { return { name, requires, minLevel }; }
function names(ms) { return ms.map(m => m.name); }

describe("CharacterMoves.sortPlaybookMoves", () => {
	const moves = makeMoves();

	it("returns empty array for empty input", () => {
		expect(moves.sortPlaybookMoves([])).toEqual([]);
	});

	it("single move with no requires is returned as-is", () => {
		expect(names(moves.sortPlaybookMoves([mv("Alpha")]))).toEqual(["Alpha"]);
	});

	it("multiple independent moves are sorted alphabetically", () => {
		expect(names(moves.sortPlaybookMoves([mv("Charlie"), mv("Alpha"), mv("Bravo")]))).toEqual(["Alpha", "Bravo", "Charlie"]);
	});

	it("a move that requires another follows it immediately", () => {
		const result = names(moves.sortPlaybookMoves([mv("Child", { requires: "Parent" }), mv("Parent"), mv("Alpha")]));
		expect(result).toEqual(["Alpha", "Parent", "Child"]);
	});

	it("multiple moves requiring the same parent are sorted alphabetically after it", () => {
		const ms = [mv("Zeta", { requires: "Parent" }), mv("Alpha", { requires: "Parent" }), mv("Parent"), mv("Root")];
		expect(names(moves.sortPlaybookMoves(ms))).toEqual(["Parent", "Alpha", "Zeta", "Root"]);
	});

	it("chains: grandchild follows child follows parent", () => {
		const ms = [mv("Grandchild", { requires: "Child" }), mv("Child", { requires: "Parent" }), mv("Parent")];
		expect(names(moves.sortPlaybookMoves(ms))).toEqual(["Parent", "Child", "Grandchild"]);
	});

	it("root moves stay alphabetical while dependents follow their parents", () => {
		const ms = [
			mv("Zeal"), mv("Zeal-Child", { requires: "Zeal" }),
			mv("Armor"), mv("Armor-Child-B", { requires: "Armor" }), mv("Armor-Child-A", { requires: "Armor" }),
		];
		expect(names(moves.sortPlaybookMoves(ms))).toEqual(["Armor", "Armor-Child-A", "Armor-Child-B", "Zeal", "Zeal-Child"]);
	});

	it("move requiring a non-existent parent is treated as a root", () => {
		expect(names(moves.sortPlaybookMoves([mv("Orphan", { requires: "Missing Parent" }), mv("Alpha")]))).toEqual(["Alpha", "Orphan"]);
	});

	it("circular dependency does not infinite-loop", () => {
		const ms = [mv("A", { requires: "B" }), mv("B", { requires: "A" })];
		expect(() => moves.sortPlaybookMoves(ms)).not.toThrow();
		expect(moves.sortPlaybookMoves(ms)).toHaveLength(2);
	});

	it("level-6 moves come after all level-0 moves", () => {
		expect(names(moves.sortPlaybookMoves([mv("Bravo", { minLevel: 6 }), mv("Alpha"), mv("Charlie", { minLevel: 6 })]))).toEqual(["Alpha", "Bravo", "Charlie"]);
	});

	it("level groups are sorted ascending: 0, 2, 6", () => {
		expect(names(moves.sortPlaybookMoves([mv("L6", { minLevel: 6 }), mv("L2", { minLevel: 2 }), mv("L0")]))).toEqual(["L0", "L2", "L6"]);
	});

	it("within a level group, dependency chaining still applies", () => {
		const ms = [mv("Child", { minLevel: 6, requires: "Parent" }), mv("Parent", { minLevel: 6 }), mv("Alpha", { minLevel: 6 })];
		expect(names(moves.sortPlaybookMoves(ms))).toEqual(["Alpha", "Parent", "Child"]);
	});

	it("cross-level dependency is ignored: level-6 move requiring level-0 move stays in level-6 group", () => {
		const ms = [mv("Root"), mv("Lv6-Child", { minLevel: 6, requires: "Root" }), mv("Alpha")];
		expect(names(moves.sortPlaybookMoves(ms))).toEqual(["Alpha", "Root", "Lv6-Child"]);
	});
});

// ── buildSnapshot ─────────────────────────────────────────────────────────────

describe("CharacterMoves.buildSnapshot — empty", () => {
	it("returns a Movelist when no categories in flags", () => {
		expect(makeMoves().buildSnapshot()).toBeInstanceOf(Movelist);
	});

	it("categories is empty when no categories stored in flags", () => {
		expect(makeMoves().buildSnapshot().categories).toHaveLength(0);
	});
});

describe("CharacterMoves.buildSnapshot — categories from flags", () => {
	it("returns one category per entry in flags", () => {
		const flags = makeFlags({ categories: [makeFlagCategory("basic")] });
		const result = makeMoves({ flags }).buildSnapshot();
		expect(result.categories).toHaveLength(1);
	});

	it("category is a MoveCategorySnapshot", () => {
		const flags = makeFlags({ categories: [makeFlagCategory("basic")] });
		const result = makeMoves({ flags }).buildSnapshot();
		expect(result.categories[0]).toBeInstanceOf(MoveCategorySnapshot);
	});

	it("category key, label, renderStyle, allowAdditional, note preserved", () => {
		const catData = { key: "playbook-the-heavy", label: "The Heavy", renderStyle: "standard", allowAdditional: false, note: "Pick 2.", moves: [] };
		const flags = makeFlags({ categories: [catData] });
		const cat = makeMoves({ flags }).buildSnapshot().categories[0];
		expect(cat.key).toBe("playbook-the-heavy");
		expect(cat.label).toBe("The Heavy");
		expect(cat.renderStyle).toBe("standard");
		expect(cat.allowAdditional).toBe(false);
		expect(cat.note).toBe("Pick 2.");
	});

	it("each move in a category becomes a MoveSnapshot", () => {
		const flags = makeFlags({ categories: [
			makeFlagCategory("basic", { moves: [makeFlagMove("Defy Danger", { selection: { max: 1, value: 1 } })] }),
		]});
		const cat = makeMoves({ flags }).buildSnapshot().categories[0];
		expect(cat.moves[0]).toBeInstanceOf(MoveSnapshot);
	});

	it("move selection is a ValueMax", () => {
		const flags = makeFlags({ categories: [
			makeFlagCategory("basic", { moves: [makeFlagMove("Defy Danger", { selection: { max: 1, value: 1 } })] }),
		]});
		const snap = makeMoves({ flags }).buildSnapshot().categories[0].moves[0];
		expect(snap.selection).toBeInstanceOf(ValueMax);
		expect(snap.selection.value).toBe(1);
		expect(snap.selection.max).toBe(1);
	});

	it("move ownedId is last entry in ownedIds", () => {
		const flags = makeFlags({ categories: [
			makeFlagCategory("basic", { moves: [makeFlagMove("Defy Danger", { ownedIds: ["id1", "id2"] })] }),
		]});
		const snap = makeMoves({ flags }).buildSnapshot().categories[0].moves[0];
		expect(snap.ownedId).toBe("id2");
	});

	it("move ownedId is null when ownedIds is empty", () => {
		const flags = makeFlags({ categories: [
			makeFlagCategory("basic", { moves: [makeFlagMove("Defy Danger")] }),
		]});
		expect(makeMoves({ flags }).buildSnapshot().categories[0].moves[0].ownedId).toBeNull();
	});

	it("move resource is mapped from flags", () => {
		const moveWithResource = makeFlagMove("Resource Move", {
			resource: { max: 3, title: "Favor", labels: [], current: 2 },
			selection: { max: 1, value: 1 },
		});
		const flags = makeFlags({ categories: [makeFlagCategory("cat", { moves: [moveWithResource] })] });
		const snap = makeMoves({ flags }).buildSnapshot().categories[0].moves[0];
		expect(snap.resource).not.toBeNull();
		expect(snap.resource.max).toBe(3);
		expect(snap.resource.current).toBe(2);
	});

	it("move resource is null when not set", () => {
		const flags = makeFlags({ categories: [
			makeFlagCategory("basic", { moves: [makeFlagMove("Defy Danger")] }),
		]});
		expect(makeMoves({ flags }).buildSnapshot().categories[0].moves[0].resource).toBeNull();
	});
});

describe("CharacterMoves.buildSnapshot — requiresLabel", () => {
	it("requiresLabel is null when no requirement", () => {
		const flags = makeFlags({ categories: [
			makeFlagCategory("cat", { moves: [makeFlagMove("Alpha")] }),
		]});
		expect(makeMoves({ flags }).buildSnapshot().categories[0].moves[0].requiresLabel).toBeNull();
	});

	it("requiresLabel is 'Level N' when only a level requirement", () => {
		const flags = makeFlags({ categories: [
			makeFlagCategory("cat", { moves: [makeFlagMove("Alpha", { requirement: { moves: [], level: 6, playbook: null } })] }),
		]});
		expect(makeMoves({ flags }).buildSnapshot().categories[0].moves[0].requiresLabel).toBe("Level 6");
	});

	it("requiresLabel lists required move names when only moves requirement", () => {
		const flags = makeFlags({ categories: [
			makeFlagCategory("cat", { moves: [makeFlagMove("Alpha", { requirement: { moves: ["Wild Speech", "Spirit Tongue"], level: null, playbook: null } })] }),
		]});
		expect(makeMoves({ flags }).buildSnapshot().categories[0].moves[0].requiresLabel).toBe("Wild Speech, Spirit Tongue");
	});

	it("requiresLabel combines moves and level", () => {
		const flags = makeFlags({ categories: [
			makeFlagCategory("cat", { moves: [makeFlagMove("Alpha", { requirement: { moves: ["Wild Speech"], level: 6, playbook: null } })] }),
		]});
		expect(makeMoves({ flags }).buildSnapshot().categories[0].moves[0].requiresLabel).toBe("Wild Speech, Level 6");
	});

	it("requiresLabel is null when requirement has only playbook field", () => {
		const flags = makeFlags({ categories: [
			makeFlagCategory("cat", { moves: [makeFlagMove("Alpha", { requirement: { moves: [], level: null, playbook: "The Ranger" } })] }),
		]});
		expect(makeMoves({ flags }).buildSnapshot().categories[0].moves[0].requiresLabel).toBeNull();
	});
});

describe("CharacterMoves.buildSnapshot — selectable computation", () => {
	it("selectable=false when selection.value >= selection.max", () => {
		const flags = makeFlags({ categories: [
			makeFlagCategory("cat", { moves: [makeFlagMove("Alpha", { selection: { max: 1, value: 1 } })] }),
		]});
		expect(makeMoves({ flags }).buildSnapshot().categories[0].moves[0].selectable).toBe(false);
	});

	it("selectable=true when selection.value < selection.max and no requirement", () => {
		const flags = makeFlags({ categories: [
			makeFlagCategory("cat", { moves: [makeFlagMove("Alpha", { selection: { max: 2, value: 1 } })] }),
		]});
		expect(makeMoves({ flags }).buildSnapshot().categories[0].moves[0].selectable).toBe(true);
	});

	it("selectable=false when level requirement exceeds actor level", () => {
		const flags = makeFlags({ categories: [
			makeFlagCategory("cat", { moves: [makeFlagMove("Alpha", { requirement: { moves: [], level: 6, playbook: null } })] }),
		]});
		const actor = makeActor(1);
		expect(makeMoves({ flags, actor }).buildSnapshot().categories[0].moves[0].selectable).toBe(false);
	});

	it("selectable=true when level requirement equals actor level", () => {
		const flags = makeFlags({ categories: [
			makeFlagCategory("cat", { moves: [makeFlagMove("Alpha", { requirement: { moves: [], level: 3, playbook: null } })] }),
		]});
		const actor = makeActor(3);
		expect(makeMoves({ flags, actor }).buildSnapshot().categories[0].moves[0].selectable).toBe(true);
	});

	it("selectable=false when required move not yet acquired", () => {
		const flags = makeFlags({ categories: [
			makeFlagCategory("cat", { moves: [
				makeFlagMove("Parent"),
				makeFlagMove("Child", { requirement: { moves: ["Parent"], level: null, playbook: null } }),
			]}),
		]});
		expect(makeMoves({ flags }).buildSnapshot().categories[0].moves[1].selectable).toBe(false);
	});

	it("selectable=true when required move is acquired", () => {
		const flags = makeFlags({ categories: [
			makeFlagCategory("cat", { moves: [
				makeFlagMove("Parent", { selection: { max: 1, value: 1 } }),
				makeFlagMove("Child", { requirement: { moves: ["Parent"], level: null, playbook: null } }),
			]}),
		]});
		expect(makeMoves({ flags }).buildSnapshot().categories[0].moves[1].selectable).toBe(true);
	});
});

// ── getMoveSnapshotsForCategory ───────────────────────────────────────────────

describe("CharacterMoves.getMoveSnapshotsForCategory", () => {
	it("returns empty array when category not found", () => {
		expect(makeMoves().getMoveSnapshotsForCategory("post-death-revenant")).toHaveLength(0);
	});

	it("returns MoveSnapshot for each move in the category", () => {
		const flags = makeFlags({ categories: [
			makeFlagCategory("post-death-revenant", { moves: [makeFlagMove("Haunt")] }),
		]});
		const snaps = makeMoves({ flags }).getMoveSnapshotsForCategory("post-death-revenant");
		expect(snaps).toHaveLength(1);
		expect(snaps[0]).toBeInstanceOf(MoveSnapshot);
		expect(snaps[0].name).toBe("Haunt");
	});

	it("returned snapshot has correct source.type", () => {
		const flags = makeFlags({ categories: [
			makeFlagCategory("post-death-revenant", { moves: [makeFlagMove("Haunt")] }),
		]});
		const snap = makeMoves({ flags }).getMoveSnapshotsForCategory("post-death-revenant")[0];
		expect(snap.source.type).toBe("post-death-revenant");
	});
});

// ── initBasicMoves ────────────────────────────────────────────────────────────

describe("CharacterMoves.initBasicMoves", () => {
	it("does nothing when basic category already exists", async () => {
		const store = { categories: [makeFlagCategory("basic")] };
		const flags = makeFlags(store);
		const actor = makeActor();
		await makeMoves({ flags, actor }).initBasicMoves();
		expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
		expect(flags.setFlag).not.toHaveBeenCalled();
	});

	it("creates embedded docs for each basic move", async () => {
		const repo = new FakeMoveRepository([], [
			{ _id: "b1", name: "Defy Danger", system: { rollType: "str" }, toObject: () => ({ name: "Defy Danger", type: "move", system: {} }) },
		]);
		const actor = makeActor();
		await makeMoves({ repo, actor }).initBasicMoves();
		expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith("Item", [
			expect.objectContaining({ system: expect.objectContaining({ moveType: "basic" }) }),
		]);
	});

	it("writes a basic category to flags with side-bar renderStyle", async () => {
		const store = {};
		const flags = makeFlags(store);
		await makeMoves({ flags }).initBasicMoves();
		expect(flags.setFlag).toHaveBeenCalledWith("categories", expect.arrayContaining([
			expect.objectContaining({ key: "basic", renderStyle: "side-bar" }),
		]));
	});

	it("each move in the stored category has selection.value=1 (starting)", async () => {
		const repo = new FakeMoveRepository([], [
			{ _id: "b1", name: "Defy Danger", system: { rollType: "str" }, toObject: () => ({ name: "Defy Danger", type: "move", system: {} }) },
		]);
		const store = {};
		const flags = makeFlags(store);
		await makeMoves({ repo, flags }).initBasicMoves();
		const saved = flags.setFlag.mock.calls[0][1];
		expect(saved[0].moves[0].selection.value).toBe(1);
	});
});

// ── initPlaybookCategory ──────────────────────────────────────────────────────

describe("CharacterMoves.initPlaybookCategory", () => {
	it("writes a playbook-<slug> category to flags", async () => {
		const store = {};
		const flags = makeFlags(store);
		const playbookData = makePlaybookData();
		await makeMoves({ flags }).initPlaybookCategory(playbookData);
		expect(flags.setFlag).toHaveBeenCalledWith("categories", expect.arrayContaining([
			expect.objectContaining({ key: "playbook-the-heavy" }),
		]));
	});

	it("creates embedded docs for starting moves", async () => {
		const repo = new FakeMoveRepository([
			{ _id: "m1", name: "Bulwark", system: { isStartingMove: true }, toObject: () => ({ name: "Bulwark", type: "move", system: {} }) },
		]);
		const actor = makeActor();
		const playbookData = makePlaybookData();
		await makeMoves({ repo, actor }).initPlaybookCategory(playbookData);
		expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith("Item", [
			expect.objectContaining({ system: expect.objectContaining({ moveType: "playbook-the-heavy" }) }),
		]);
	});

	it("does not create embedded docs for non-starting moves", async () => {
		const repo = new FakeMoveRepository([
			{ _id: "m1", name: "Optional", system: { isStartingMove: false }, toObject: () => ({ name: "Optional", type: "move", system: {} }) },
		]);
		const actor = makeActor();
		const playbookData = makePlaybookData();
		await makeMoves({ repo, actor }).initPlaybookCategory(playbookData);
		expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it("starting move has selection.value=1 in flags", async () => {
		const repo = new FakeMoveRepository([
			{ _id: "m1", name: "Bulwark", system: { isStartingMove: true }, toObject: () => ({ name: "Bulwark", type: "move", system: {} }) },
		]);
		const store = {};
		const flags = makeFlags(store);
		const playbookData = makePlaybookData();
		await makeMoves({ repo, flags }).initPlaybookCategory(playbookData);
		const saved = flags.setFlag.mock.calls.at(-1)[1];
		const cat = saved.find(c => c.key === "playbook-the-heavy");
		expect(cat.moves.find(m => m.name === "Bulwark").selection.value).toBe(1);
	});

	it("non-starting move has selection.value=0 in flags", async () => {
		const repo = new FakeMoveRepository([
			{ _id: "m1", name: "Optional", system: { isStartingMove: false }, toObject: () => ({ name: "Optional", type: "move", system: {} }) },
		]);
		const store = {};
		const flags = makeFlags(store);
		const playbookData = makePlaybookData();
		await makeMoves({ repo, flags }).initPlaybookCategory(playbookData);
		const saved = flags.setFlag.mock.calls.at(-1)[1];
		const cat = saved.find(c => c.key === "playbook-the-heavy");
		expect(cat.moves.find(m => m.name === "Optional").selection.value).toBe(0);
	});

	it("removes existing playbook-* category before adding new one", async () => {
		const store = { categories: [makeFlagCategory("playbook-the-fox", { moves: [makeFlagMove("Fox Move", { ownedIds: ["old-id"] })] })] };
		const flags = makeFlags(store);
		const actor = makeActor();
		const playbookData = makePlaybookData();
		await makeMoves({ flags, actor }).initPlaybookCategory(playbookData);
		expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith("Item", ["old-id"]);
		const saved = flags.setFlag.mock.calls.at(-1)[1];
		expect(saved.find(c => c.key === "playbook-the-fox")).toBeUndefined();
	});

});

// ── addCategory ───────────────────────────────────────────────────────────────

describe("CharacterMoves.addCategory", () => {
	it("appends the category to flags", async () => {
		const store = {};
		const flags = makeFlags(store);
		await makeMoves({ flags }).addCategory("post-death-revenant", "Revenant", "revenant");
		expect(flags.setFlag).toHaveBeenCalledWith("categories", expect.arrayContaining([
			expect.objectContaining({ key: "post-death-revenant", label: "Revenant" }),
		]));
	});

	it("does nothing when category already exists", async () => {
		const store = { categories: [makeFlagCategory("post-death-revenant")] };
		const flags = makeFlags(store);
		const actor = makeActor();
		await makeMoves({ flags, actor }).addCategory("post-death-revenant", "Revenant", "revenant");
		expect(flags.setFlag).not.toHaveBeenCalled();
		expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it("creates embedded docs for each post-death move", async () => {
		const repo = new FakeMoveRepository([], [], [
			{ _id: "m1", name: "Haunt", system: { rollType: "wis", description: "A ghost." } },
		]);
		const actor = makeActor();
		await makeMoves({ repo, actor }).addCategory("post-death-revenant", "Revenant", "revenant");
		expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith("Item", [
			expect.objectContaining({ system: expect.objectContaining({ moveType: "post-death-revenant" }) }),
		]);
	});

	it("does not call createEmbeddedDocuments when repo returns no moves", async () => {
		const actor = makeActor();
		await makeMoves({ actor }).addCategory("post-death-revenant", "Revenant", "revenant");
		expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it("stored category has renderStyle=standard and allowAdditional=false", async () => {
		const store = {};
		const flags = makeFlags(store);
		await makeMoves({ flags }).addCategory("post-death-revenant", "Revenant", "revenant");
		const cat = flags.setFlag.mock.calls[0][1].find(c => c.key === "post-death-revenant");
		expect(cat.renderStyle).toBe("standard");
		expect(cat.allowAdditional).toBe(false);
	});

	it("each move stored in the category has selection.value=1", async () => {
		const repo = new FakeMoveRepository([], [], [
			{ _id: "m1", name: "Haunt", system: { rollType: "wis", description: "" } },
		]);
		const store = {};
		const flags = makeFlags(store);
		await makeMoves({ repo, flags }).addCategory("post-death-revenant", "Revenant", "revenant");
		const cat = flags.setFlag.mock.calls[0][1].find(c => c.key === "post-death-revenant");
		expect(cat.moves[0].selection.value).toBe(1);
	});
});

// ── removeCategory ────────────────────────────────────────────────────────────

describe("CharacterMoves.removeCategory", () => {
	it("removes the category from flags", async () => {
		const store = { categories: [makeFlagCategory("post-death-revenant")] };
		const flags = makeFlags(store);
		await makeMoves({ flags }).removeCategory("post-death-revenant");
		const saved = flags.setFlag.mock.calls[0][1];
		expect(saved.find(c => c.key === "post-death-revenant")).toBeUndefined();
	});

	it("deletes embedded docs for all ownedIds in the category", async () => {
		const store = { categories: [
			makeFlagCategory("post-death-revenant", { moves: [makeFlagMove("Haunt", { ownedIds: ["pd1"] })] }),
		]};
		const flags = makeFlags(store);
		const actor = makeActor();
		await makeMoves({ flags, actor }).removeCategory("post-death-revenant");
		expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith("Item", ["pd1"]);
	});

	it("does not call deleteEmbeddedDocuments when no ownedIds", async () => {
		const store = { categories: [makeFlagCategory("post-death-revenant", { moves: [makeFlagMove("Haunt")] })] };
		const flags = makeFlags(store);
		const actor = makeActor();
		await makeMoves({ flags, actor }).removeCategory("post-death-revenant");
		expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it("does nothing when category does not exist", async () => {
		const flags = makeFlags({});
		const actor = makeActor();
		await makeMoves({ flags, actor }).removeCategory("post-death-revenant");
		expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		expect(flags.setFlag).not.toHaveBeenCalled();
	});

	it("category is gone from subsequent buildSnapshot", async () => {
		const store = { categories: [makeFlagCategory("post-death-revenant")] };
		const flags = makeFlags(store);
		const m = makeMoves({ flags });
		await m.removeCategory("post-death-revenant");
		expect(m.buildSnapshot().categories.find(c => c.key === "post-death-revenant")).toBeUndefined();
	});
});

// ── incrementMove ─────────────────────────────────────────────────────────────

describe("CharacterMoves.incrementMove", () => {
	it("increments selection.value in flags", async () => {
		const store = { categories: [
			makeFlagCategory("cat", { moves: [makeFlagMove("Alpha", { selection: { max: 2, value: 0 } })] }),
		]};
		const flags = makeFlags(store);
		await makeMoves({ flags }).incrementMove("cat", "Alpha");
		const saved = flags.setFlag.mock.calls.at(-1)[1];
		const move = saved.find(c => c.key === "cat").moves.find(m => m.name === "Alpha");
		expect(move.selection.value).toBe(1);
	});

	it("does nothing when already at max", async () => {
		const store = { categories: [
			makeFlagCategory("cat", { moves: [makeFlagMove("Alpha", { selection: { max: 1, value: 1 } })] }),
		]};
		const flags = makeFlags(store);
		const actor = makeActor();
		await makeMoves({ flags, actor }).incrementMove("cat", "Alpha");
		expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
		expect(flags.setFlag).not.toHaveBeenCalled();
	});

	it("creates an embedded doc", async () => {
		const store = { categories: [
			makeFlagCategory("cat", { moves: [makeFlagMove("Alpha", { selection: { max: 2, value: 0 } })] }),
		]};
		const flags = makeFlags(store);
		const actor = makeActor();
		await makeMoves({ flags, actor }).incrementMove("cat", "Alpha");
		expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith("Item", [
			expect.objectContaining({ name: "Alpha", type: "move" }),
		]);
	});

	it("stores the new ownedId in flags", async () => {
		const store = { categories: [
			makeFlagCategory("cat", { moves: [makeFlagMove("Alpha", { selection: { max: 2, value: 0 } })] }),
		]};
		const flags = makeFlags(store);
		const actor = makeActor();
		await makeMoves({ flags, actor }).incrementMove("cat", "Alpha");
		const saved = flags.setFlag.mock.calls.at(-1)[1];
		const move = saved.find(c => c.key === "cat").moves.find(m => m.name === "Alpha");
		expect(move.ownedIds).toHaveLength(1);
	});
});

// ── decrementMove ─────────────────────────────────────────────────────────────

describe("CharacterMoves.decrementMove", () => {
	it("decrements selection.value in flags", async () => {
		const store = { categories: [
			makeFlagCategory("cat", { moves: [makeFlagMove("Alpha", { selection: { max: 1, value: 1 }, ownedIds: ["id1"] })] }),
		]};
		const flags = makeFlags(store);
		const actor = makeActor();
		await makeMoves({ flags, actor }).decrementMove("cat", "Alpha");
		const saved = flags.setFlag.mock.calls.at(-1)[1];
		const move = saved.find(c => c.key === "cat").moves.find(m => m.name === "Alpha");
		expect(move.selection.value).toBe(0);
	});

	it("deletes the last owned embedded doc", async () => {
		const store = { categories: [
			makeFlagCategory("cat", { moves: [makeFlagMove("Alpha", { selection: { max: 1, value: 1 }, ownedIds: ["id1"] })] }),
		]};
		const flags = makeFlags(store);
		const actor = makeActor();
		await makeMoves({ flags, actor }).decrementMove("cat", "Alpha");
		expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith("Item", ["id1"]);
	});

	it("does nothing when value is already 0", async () => {
		const store = { categories: [
			makeFlagCategory("cat", { moves: [makeFlagMove("Alpha", { selection: { max: 1, value: 0 } })] }),
		]};
		const flags = makeFlags(store);
		const actor = makeActor();
		await makeMoves({ flags, actor }).decrementMove("cat", "Alpha");
		expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		expect(flags.setFlag).not.toHaveBeenCalled();
	});

	it("does not decrement below 1 when isStarting", async () => {
		const store = { categories: [
			makeFlagCategory("cat", { moves: [makeFlagMove("Alpha", { isStarting: true, selection: { max: 1, value: 1 }, ownedIds: ["id1"] })] }),
		]};
		const flags = makeFlags(store);
		const actor = makeActor();
		await makeMoves({ flags, actor }).decrementMove("cat", "Alpha");
		expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		expect(flags.setFlag).not.toHaveBeenCalled();
	});
});

// ── addMoveToOther ────────────────────────────────────────────────────────────

describe("CharacterMoves.addMoveToOther", () => {
	it("returns true and adds the move to the other category", async () => {
		const flags = makeFlags({});
		const result = await makeMoves({ flags }).addMoveToOther({ name: "Custom Move", system: {} });
		expect(result).toBe(true);
		const saved = flags.setFlag.mock.calls.at(-1)[1];
		const other = saved.find(c => c.key === "other");
		expect(other.moves.find(m => m.name === "Custom Move")).toBeDefined();
	});

	it("creates the other category if it does not exist", async () => {
		const flags = makeFlags({});
		await makeMoves({ flags }).addMoveToOther({ name: "Custom Move", system: {} });
		const saved = flags.setFlag.mock.calls.at(-1)[1];
		expect(saved.find(c => c.key === "other")).toBeDefined();
	});

	it("other category has allowAdditional=true", async () => {
		const flags = makeFlags({});
		await makeMoves({ flags }).addMoveToOther({ name: "Custom Move", system: {} });
		const saved = flags.setFlag.mock.calls.at(-1)[1];
		expect(saved.find(c => c.key === "other").allowAdditional).toBe(true);
	});

	it("returns false when move with same name already in other", async () => {
		const store = { categories: [
			makeFlagCategory("other", { allowAdditional: true, moves: [makeFlagMove("Custom Move")] }),
		]};
		const flags = makeFlags(store);
		const actor = makeActor();
		const result = await makeMoves({ flags, actor }).addMoveToOther({ name: "Custom Move", system: {} });
		expect(result).toBe(false);
		expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it("creates an embedded doc for the move", async () => {
		const flags = makeFlags({});
		const actor = makeActor();
		await makeMoves({ flags, actor }).addMoveToOther({ name: "Custom Move", system: { rollType: "str" } });
		expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith("Item", [
			expect.objectContaining({ name: "Custom Move", type: "move", system: expect.objectContaining({ moveType: "other" }) }),
		]);
	});
});

// ── deleteMove ────────────────────────────────────────────────────────────────

describe("CharacterMoves.deleteMove", () => {
	it("removes the move from the other category in flags", async () => {
		const store = { categories: [
			makeFlagCategory("other", { moves: [makeFlagMove("To Delete")] }),
		]};
		const flags = makeFlags(store);
		await makeMoves({ flags }).deleteMove("To Delete");
		const saved = flags.setFlag.mock.calls[0][1];
		expect(saved.find(c => c.key === "other").moves.find(m => m.name === "To Delete")).toBeUndefined();
	});

	it("deletes embedded docs", async () => {
		const store = { categories: [
			makeFlagCategory("other", { moves: [makeFlagMove("To Delete", { ownedIds: ["id1"] })] }),
		]};
		const flags = makeFlags(store);
		const actor = makeActor();
		await makeMoves({ flags, actor }).deleteMove("To Delete");
		expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith("Item", ["id1"]);
	});

	it("does nothing when move not found in other", async () => {
		const flags = makeFlags({});
		const actor = makeActor();
		await makeMoves({ flags, actor }).deleteMove("Nonexistent");
		expect(flags.setFlag).not.toHaveBeenCalled();
		expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
	});
});

// ── setMoveResourceCurrent ────────────────────────────────────────────────────

describe("CharacterMoves.setMoveResourceCurrent", () => {
	it("updates resource.current in flags", async () => {
		const store = { categories: [
			makeFlagCategory("cat", { moves: [
				makeFlagMove("Resource Move", {
					selection: { max: 1, value: 1 },
					resource: { max: 3, title: "Favor", labels: [], current: 0 },
				}),
			]}),
		]};
		const flags = makeFlags(store);
		await makeMoves({ flags }).setMoveResourceCurrent("cat", "Resource Move", 2);
		const saved = flags.setFlag.mock.calls[0][1];
		const move = saved.find(c => c.key === "cat").moves.find(m => m.name === "Resource Move");
		expect(move.resource.current).toBe(2);
	});

	it("does not modify moves without a resource", async () => {
		const store = { categories: [
			makeFlagCategory("cat", { moves: [makeFlagMove("No Resource")] }),
		]};
		const flags = makeFlags(store);
		await makeMoves({ flags }).setMoveResourceCurrent("cat", "No Resource", 5);
		const saved = flags.setFlag.mock.calls[0][1];
		const move = saved.find(c => c.key === "cat").moves.find(m => m.name === "No Resource");
		expect(move.resource).toBeNull();
	});
});

// ── onDropMove ────────────────────────────────────────────────────────────────

describe("CharacterMoves.onDropMove", () => {
	it("increments selection for existing playbook move", async () => {
		const store = { categories: [
			makeFlagCategory("playbook-the-heavy", { moves: [makeFlagMove("Bulwark", { selection: { max: 2, value: 0 } })] }),
		]};
		const flags = makeFlags(store);
		const actor = makeActor();
		const result = await makeMoves({ flags, actor }).onDropMove({ name: "Bulwark", system: {} });
		expect(result).toBe(true);
		expect(actor.createEmbeddedDocuments).toHaveBeenCalled();
	});

	it("returns false when playbook move is already at max selection", async () => {
		const store = { categories: [
			makeFlagCategory("playbook-the-heavy", { moves: [makeFlagMove("Bulwark", { selection: { max: 1, value: 1 } })] }),
		]};
		const flags = makeFlags(store);
		const actor = makeActor();
		const result = await makeMoves({ flags, actor }).onDropMove({ name: "Bulwark", system: {} });
		expect(result).toBe(false);
	});

	it("adds unknown move to other category", async () => {
		const flags = makeFlags({});
		const actor = makeActor();
		const result = await makeMoves({ flags, actor }).onDropMove({ name: "Stranger Move", system: {} });
		expect(result).toBe(true);
		const saved = flags.setFlag.mock.calls.at(-1)[1];
		expect(saved.find(c => c.key === "other")).toBeDefined();
	});
});

// ── countOwnedByName ──────────────────────────────────────────────────────────

describe("CharacterMoves.countOwnedByName", () => {
	it("returns 0 when no categories exist", () => {
		expect(makeMoves().countOwnedByName("Bulwark")).toBe(0);
	});

	it("returns 0 when move exists but selection.value=0", () => {
		const flags = makeFlags({ categories: [
			makeFlagCategory("cat", { moves: [makeFlagMove("Bulwark", { selection: { max: 1, value: 0 } })] }),
		]});
		expect(makeMoves({ flags }).countOwnedByName("Bulwark")).toBe(0);
	});

	it("returns selection.value when move is acquired", () => {
		const flags = makeFlags({ categories: [
			makeFlagCategory("cat", { moves: [makeFlagMove("Bulwark", { selection: { max: 2, value: 2 } })] }),
		]});
		expect(makeMoves({ flags }).countOwnedByName("Bulwark")).toBe(2);
	});

	it("returns 0 when move name does not match any category", () => {
		const flags = makeFlags({ categories: [
			makeFlagCategory("cat", { moves: [makeFlagMove("Alpha")] }),
		]});
		expect(makeMoves({ flags }).countOwnedByName("Bulwark")).toBe(0);
	});
});
