import { describe, expect, it } from "vitest";
import { CharacterMoves } from "../../../src/actors/character/CharacterMoves.js";
import { toSlug } from "../../../src/utils/slug.js";
import { ChoiceGroupController } from "../../../src/actors/character/ChoiceGroupController.js";
import { ResourceController } from "../../../src/actors/character/ResourceController.js";
import { FakeMoveRepository } from "../../fakes/FakeMoveRepository.js";
import { FakeFlags } from "../../fakes/FakeFlags.js";
import { FakeActor } from "../../fakes/FakeActor.js";
import { TestMoveBuilder } from "../../fakes/TestMoveBuilder.js";
import { TestChoiceGroupBuilder } from "../../fakes/TestChoiceGroupBuilder.js";
import { TestChoiceRowBuilder } from "../../fakes/TestChoiceRowBuilder.js";
import {
	MoveSnapshot,
	Movelist,
	MoveCategorySnapshot,
	ValueMax,
	ChoiceGroup,
} from "../../../src/model/snapshot/character/CharacterSnapshot.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFlags(initialData = {}) {
	const fake = new FakeFlags();
	for (const [key, value] of Object.entries(initialData)) {
		fake.setFlagNonAsync("stonetop", key, value);
	}
	return {
		getFlag:     (key)       => fake.getFlag("stonetop", key),
		setFlag:     async (key, val) => { await fake.setFlag("stonetop", key, val); },
		get state()  { return fake.storage.stonetop ?? {}; },
	};
}

function makeActor() {
	const actor = new FakeActor();
	let nextId = 0;
	actor.createdDocs = [];
	actor.deletedIds  = [];
	actor.createEmbeddedDocuments = async (_, docs) => {
		const results = docs.map(d => ({ _id: `created-${nextId++}`, name: d.name }));
		actor.createdDocs.push(...results);
		return results;
	};
	actor.deleteEmbeddedDocuments = async (_, ids) => { actor.deletedIds.push(...ids); };
	return actor;
}

function makeMoves({
	repo     = new FakeMoveRepository(),
	flags    = makeFlags(),
	actor    = makeActor(),
	vitals   = { level: 1 },
	resFlags = makeFlags(),
} = {}) {
	const ctrl = new ChoiceGroupController(flags);
	const res  = new ResourceController(resFlags);
	const m    = new CharacterMoves(repo, flags, actor, ctrl, res);
	m.setVitals(vitals);
	return m;
}

function makePlaybookData(overrides = {}) {
	return { slug: "the-heavy", name: "The Heavy", startingMovesNote: null, backgrounds: [], ...overrides };
}

// ── sortPlaybookMoves ─────────────────────────────────────────────────────────

function mv(name, { requires = null, minLevel = null } = {}) { return { name, requires, minLevel }; }
function names(ms) { return ms.map(m => m.name); }

describe("CharacterMoves.sortPlaybookMoves", () => {
	const moves = makeMoves();
	it("returns empty array for empty input", () => { expect(moves.sortPlaybookMoves([])).toEqual([]); });
	it("single move with no requires is returned as-is", () => { expect(names(moves.sortPlaybookMoves([mv("Alpha")]))).toEqual(["Alpha"]); });
	it("multiple independent moves are sorted alphabetically", () => { expect(names(moves.sortPlaybookMoves([mv("Charlie"), mv("Alpha"), mv("Bravo")]))).toEqual(["Alpha", "Bravo", "Charlie"]); });
	it("a move that requires another follows it immediately", () => { expect(names(moves.sortPlaybookMoves([mv("Child", { requires: "Parent" }), mv("Parent"), mv("Alpha")]))).toEqual(["Alpha", "Parent", "Child"]); });
	it("multiple moves requiring same parent sorted alphabetically after it", () => { expect(names(moves.sortPlaybookMoves([mv("Zeta", { requires: "Parent" }), mv("Alpha", { requires: "Parent" }), mv("Parent"), mv("Root")]))).toEqual(["Parent", "Alpha", "Zeta", "Root"]); });
	it("chains: grandchild follows child follows parent", () => { expect(names(moves.sortPlaybookMoves([mv("Grandchild", { requires: "Child" }), mv("Child", { requires: "Parent" }), mv("Parent")]))).toEqual(["Parent", "Child", "Grandchild"]); });
	it("root moves stay alphabetical while dependents follow their parents", () => { expect(names(moves.sortPlaybookMoves([mv("Zeal"), mv("Zeal-Child", { requires: "Zeal" }), mv("Armor"), mv("Armor-Child-B", { requires: "Armor" }), mv("Armor-Child-A", { requires: "Armor" })]))).toEqual(["Armor", "Armor-Child-A", "Armor-Child-B", "Zeal", "Zeal-Child"]); });
	it("move requiring non-existent parent treated as root", () => { expect(names(moves.sortPlaybookMoves([mv("Orphan", { requires: "Missing Parent" }), mv("Alpha")]))).toEqual(["Alpha", "Orphan"]); });
	it("circular dependency does not infinite-loop", () => { const ms = [mv("A", { requires: "B" }), mv("B", { requires: "A" })]; expect(() => moves.sortPlaybookMoves(ms)).not.toThrow(); expect(moves.sortPlaybookMoves(ms)).toHaveLength(2); });
	it("level-6 moves come after all level-0 moves", () => { expect(names(moves.sortPlaybookMoves([mv("Bravo", { minLevel: 6 }), mv("Alpha"), mv("Charlie", { minLevel: 6 })]))).toEqual(["Alpha", "Bravo", "Charlie"]); });
	it("level groups sorted ascending: 0, 2, 6", () => { expect(names(moves.sortPlaybookMoves([mv("L6", { minLevel: 6 }), mv("L2", { minLevel: 2 }), mv("L0")]))).toEqual(["L0", "L2", "L6"]); });
	it("within a level group, dependency chaining still applies", () => { expect(names(moves.sortPlaybookMoves([mv("Child", { minLevel: 6, requires: "Parent" }), mv("Parent", { minLevel: 6 }), mv("Alpha", { minLevel: 6 })]))).toEqual(["Alpha", "Parent", "Child"]); });
	it("cross-level dependency ignored: level-6 move stays in level-6 group", () => { expect(names(moves.sortPlaybookMoves([mv("Root"), mv("Lv6-Child", { minLevel: 6, requires: "Root" }), mv("Alpha")]))).toEqual(["Alpha", "Root", "Lv6-Child"]); });
});

// ── buildSnapshot — empty ─────────────────────────────────────────────────────

describe("CharacterMoves.buildSnapshot — empty", () => {
	it("returns a Movelist when no categories in flags", async () => {
		expect(await makeMoves().buildSnapshot()).toBeInstanceOf(Movelist);
	});
	it("categories is empty when no categories stored", async () => {
		expect((await makeMoves().buildSnapshot()).categories).toHaveLength(0);
	});
});

// ── buildSnapshot — category structure ───────────────────────────────────────

describe("CharacterMoves.buildSnapshot — category structure", () => {
	it("returns one MoveCategorySnapshot per initialized category", async () => {
		const repo = new FakeMoveRepository([], [new TestMoveBuilder().withName("Defy Danger").asStarting().build()]);
		const m = makeMoves({ repo });
		await m.initBasicMoves();
		const result = await m.buildSnapshot();
		expect(result.categories).toHaveLength(1);
		expect(result.categories[0]).toBeInstanceOf(MoveCategorySnapshot);
	});

	it("category key, label, renderStyle, allowAdditional, note come from initPlaybookCategory data", async () => {
		const m = makeMoves();
		await m.initPlaybookCategory(makePlaybookData({ slug: "the-heavy", name: "The Heavy", startingMovesNote: "Pick 2." }));
		const cat = (await m.buildSnapshot()).categories[0];
		expect(cat.key).toBe("playbook-the-heavy");
		expect(cat.label).toBe("The Heavy");
		expect(cat.renderStyle).toBe("standard");
		expect(cat.allowAdditional).toBe(false);
		expect(cat.note).toBe("Pick 2.");
	});

	it("each move becomes a MoveSnapshot", async () => {
		const repo = new FakeMoveRepository([], [new TestMoveBuilder().withName("Defy Danger").asStarting().build()]);
		const m = makeMoves({ repo });
		await m.initBasicMoves();
		expect((await m.buildSnapshot()).categories[0].moves[0]).toBeInstanceOf(MoveSnapshot);
	});

	it("move selection reflects acquired state", async () => {
		const repo = new FakeMoveRepository([], [new TestMoveBuilder().withName("Defy Danger").asStarting().build()]);
		const m = makeMoves({ repo });
		await m.initBasicMoves();
		const snap = (await m.buildSnapshot()).categories[0].moves[0];
		expect(snap.selection).toBeInstanceOf(ValueMax);
		expect(snap.selection.value).toBe(1);
		expect(snap.selection.max).toBe(1);
	});

	it("move ownedId is last created doc id", async () => {
		const repo = new FakeMoveRepository([new TestMoveBuilder().withName("Bulwark").asStarting().withRepeatMax(2).build()]);
		const flags = makeFlags();
		const actor = makeActor();
		const m = makeMoves({ repo, flags, actor });
		await m.initPlaybookCategory(makePlaybookData());
		const firstId = actor.createdDocs[0]._id;
		await m.incrementMove("playbook-the-heavy", "bulwark");
		const secondId = actor.createdDocs[1]._id;
		const snap = (await m.buildSnapshot()).categories[0].moves[0];
		expect(snap.ownedId).toBe(secondId);
		expect(snap.ownedId).not.toBe(firstId);
	});

	it("move ownedId is null when move not acquired", async () => {
		const repo = new FakeMoveRepository([new TestMoveBuilder().withName("Optional").build()]);
		const m = makeMoves({ repo });
		await m.initPlaybookCategory(makePlaybookData());
		expect((await m.buildSnapshot()).categories[0].moves[0].ownedId).toBeNull();
	});

	it("move resource is null when repo has no resource definition", async () => {
		const repo = new FakeMoveRepository([], [new TestMoveBuilder().withName("Defy Danger").asStarting().build()]);
		const m = makeMoves({ repo });
		await m.initBasicMoves();
		expect((await m.buildSnapshot()).categories[0].moves[0].resource).toBeNull();
	});

	it("resource definition comes from repo, current from ResourceController", async () => {
		const repo = new FakeMoveRepository([new TestMoveBuilder().withName("Bulwark").asStarting().withResource({ max: 3, title: "Favor", labels: [] }).build()]);
		const flags   = makeFlags();
		const resFlags = makeFlags();
		const m = makeMoves({ repo, flags, resFlags });
		await m.initPlaybookCategory(makePlaybookData());
		await m.setMoveResourceCurrent("bulwark", 2);
		const snap = (await m.buildSnapshot()).categories[0].moves[0];
		expect(snap.resource.max).toBe(3);
		expect(snap.resource.current).toBe(2);
	});
});

// ── buildSnapshot — repo enrichment ──────────────────────────────────────────

describe("CharacterMoves.buildSnapshot — repo enrichment", () => {
	it("name and description come from repo move", async () => {
		const repo = new FakeMoveRepository([new TestMoveBuilder().withName("Potential for Greatness").withDescription("<p>Once per level…</p>").build()]);
		const m = makeMoves({ repo });
		await m.initPlaybookCategory(makePlaybookData());
		const snap = (await m.buildSnapshot()).categories[0].moves[0];
		expect(snap.name).toBe("Potential for Greatness");
		expect(snap.description).toBe("<p>Once per level…</p>");
	});

	it("choices from repo renders as ChoiceGroup", async () => {
		const repo = new FakeMoveRepository([new TestMoveBuilder().withName("Potential for Greatness").withChoices(CHOICES_DATA).build()]);
		const m = makeMoves({ repo });
		await m.initPlaybookCategory(makePlaybookData());
		const snap = (await m.buildSnapshot()).categories[0].moves[0];
		expect(snap.choices).toBeInstanceOf(ChoiceGroup);
		expect(snap.choices.list).toHaveLength(CHOICES_DATA.list.length);
	});

	it("selection.value comes from flag state (acquired), not repo", async () => {
		const repo = new FakeMoveRepository([new TestMoveBuilder().withName("Alpha").asStarting().build()]);
		const m = makeMoves({ repo });
		await m.initPlaybookCategory(makePlaybookData());
		expect((await m.buildSnapshot()).categories[0].moves[0].selection.value).toBe(1);
	});

	it("slug not in repo: choices and requirement are null", async () => {
		// addMoveToOther adds a custom move not in the repo
		const flags = makeFlags();
		const actor = makeActor();
		const m = makeMoves({ flags, actor });
		await m.addMoveToOther({ name: "Mystery Move", system: {} });
		const snap = (await m.buildSnapshot()).categories[0].moves[0];
		expect(snap.choices).toBeNull();
		expect(snap.requirement).toBeNull();
	});
});

// ── buildSnapshot — requiresLabel ─────────────────────────────────────────────

describe("CharacterMoves.buildSnapshot — requiresLabel", () => {
	async function snapMove(builder) {
		const repo = new FakeMoveRepository([builder.build()]);
		const m = makeMoves({ repo });
		await m.initPlaybookCategory(makePlaybookData());
		return (await m.buildSnapshot()).categories[0].moves[0];
	}

	it("requiresLabel is null when no requirement", async () => {
		expect((await snapMove(new TestMoveBuilder().withName("Alpha"))).requiresLabel).toBeNull();
	});

	it("requiresLabel is 'Level N' when only a level requirement", async () => {
		expect((await snapMove(new TestMoveBuilder().withName("Alpha").withRequirement({ moves: [], level: 6, playbook: null }))).requiresLabel).toBe("Level 6");
	});

	it("requiresLabel lists required move names", async () => {
		expect((await snapMove(new TestMoveBuilder().withName("Alpha").withRequirement({ moves: ["Wild Speech", "Spirit Tongue"], level: null, playbook: null }))).requiresLabel).toBe("Wild Speech, Spirit Tongue");
	});

	it("requiresLabel combines moves and level", async () => {
		expect((await snapMove(new TestMoveBuilder().withName("Alpha").withRequirement({ moves: ["Wild Speech"], level: 6, playbook: null }))).requiresLabel).toBe("Wild Speech, Level 6");
	});

	it("requiresLabel is null when requirement has only playbook field", async () => {
		expect((await snapMove(new TestMoveBuilder().withName("Alpha").withRequirement({ moves: [], level: null, playbook: "The Ranger" }))).requiresLabel).toBeNull();
	});
});

// ── buildSnapshot — selectable computation ────────────────────────────────────

describe("CharacterMoves.buildSnapshot — selectable computation", () => {
	it("selectable=false when acquired count equals max", async () => {
		const repo = new FakeMoveRepository([new TestMoveBuilder().withName("Alpha").asStarting().build()]);
		const m = makeMoves({ repo });
		await m.initPlaybookCategory(makePlaybookData());
		expect((await m.buildSnapshot()).categories[0].moves[0].selectable).toBe(false);
	});

	it("selectable=true when acquired count is below max", async () => {
		const repo = new FakeMoveRepository([new TestMoveBuilder().withName("Alpha").withRepeatMax(2).build()]);
		const m = makeMoves({ repo });
		await m.initPlaybookCategory(makePlaybookData());
		expect((await m.buildSnapshot()).categories[0].moves[0].selectable).toBe(true);
	});

	it("requirement.met=false when level requirement exceeds actor level", async () => {
		const repo = new FakeMoveRepository([new TestMoveBuilder().withName("Alpha").withRequirement({ moves: [], level: 6, playbook: null }).build()]);
		const m = makeMoves({ repo, vitals: { level: 1 } });
		await m.initPlaybookCategory(makePlaybookData());
		const move = (await m.buildSnapshot()).categories[0].moves[0];
		expect(move.selectable).toBe(true);
		expect(move.requirement.met).toBe(false);
	});

	it("requirement.met=true when level requirement equals actor level", async () => {
		const repo = new FakeMoveRepository([new TestMoveBuilder().withName("Alpha").withRequirement({ moves: [], level: 3, playbook: null }).build()]);
		const m = makeMoves({ repo, vitals: { level: 3 } });
		await m.initPlaybookCategory(makePlaybookData());
		const move = (await m.buildSnapshot()).categories[0].moves[0];
		expect(move.selectable).toBe(true);
		expect(move.requirement.met).toBe(true);
	});

	it("requirement.met=false when required move not yet acquired", async () => {
		const repo = new FakeMoveRepository([
			new TestMoveBuilder().withName("Parent").build(),
			new TestMoveBuilder().withName("Child").withRequirement({ moves: ["Parent"], level: null, playbook: null }).build(),
		]);
		const m = makeMoves({ repo });
		await m.initPlaybookCategory(makePlaybookData());
		const moves = (await m.buildSnapshot()).categories[0].moves;
		const child = moves.find(mv => mv.slug === "child");
		expect(child.selectable).toBe(true);
		expect(child.requirement.met).toBe(false);
	});

	it("requirement.met=true when required move is acquired", async () => {
		const repo = new FakeMoveRepository([
			new TestMoveBuilder().withName("Parent").asStarting().build(),
			new TestMoveBuilder().withName("Child").withRequirement({ moves: ["Parent"], level: null, playbook: null }).build(),
		]);
		const m = makeMoves({ repo });
		await m.initPlaybookCategory(makePlaybookData());
		const moves = (await m.buildSnapshot()).categories[0].moves;
		const child = moves.find(mv => mv.slug === "child");
		expect(child.selectable).toBe(true);
		expect(child.requirement.met).toBe(true);
	});
});

// ── getMoveSnapshotsForCategory ───────────────────────────────────────────────

describe("CharacterMoves.getMoveSnapshotsForCategory", () => {
	it("returns empty array when category not found", async () => {
		expect(await makeMoves().getMoveSnapshotsForCategory("post-death-revenant")).toHaveLength(0);
	});

	it("returns MoveSnapshot with name from repo", async () => {
		const repo = new FakeMoveRepository([], [], [new TestMoveBuilder().withName("Haunt").build()]);
		const flags = makeFlags();
		const actor = makeActor();
		const m = makeMoves({ repo, flags, actor });
		await m.addCategory("post-death-revenant", "Revenant", "revenant");
		const snaps = await m.getMoveSnapshotsForCategory("post-death-revenant");
		expect(snaps).toHaveLength(1);
		expect(snaps[0]).toBeInstanceOf(MoveSnapshot);
		expect(snaps[0].name).toBe("Haunt");
	});

	it("returned snapshot has correct source.type", async () => {
		const repo = new FakeMoveRepository([], [], [new TestMoveBuilder().withName("Haunt").build()]);
		const flags = makeFlags();
		const actor = makeActor();
		const m = makeMoves({ repo, flags, actor });
		await m.addCategory("post-death-revenant", "Revenant", "revenant");
		expect((await m.getMoveSnapshotsForCategory("post-death-revenant"))[0].source.type).toBe("post-death-revenant");
	});
});

// ── initBasicMoves ────────────────────────────────────────────────────────────

describe("CharacterMoves.initBasicMoves", () => {
	it("does nothing when basic category already exists", async () => {
		const repo = new FakeMoveRepository([], [new TestMoveBuilder().withName("Defy Danger").asStarting().build()]);
		const flags = makeFlags();
		const actor = makeActor();
		const m = makeMoves({ repo, flags, actor });
		await m.initBasicMoves();
		const firstLen = actor.createdDocs.length;
		await m.initBasicMoves();
		expect(actor.createdDocs.length).toBe(firstLen);
		expect(flags.state.categories).toHaveLength(1);
	});

	it("creates embedded docs and assigns ownedIds", async () => {
		const repo = new FakeMoveRepository([], [new TestMoveBuilder().withName("Defy Danger").asStarting().build()]);
		const flags = makeFlags();
		const actor = makeActor();
		await makeMoves({ repo, flags, actor }).initBasicMoves();
		expect(flags.state.categories.find(c => c.key === "basic").moves.find(m => m.slug === "defy-danger").ownedIds).toContain("created-0");
	});

	it("writes a basic category with side-bar renderStyle", async () => {
		const flags = makeFlags();
		await makeMoves({ flags }).initBasicMoves();
		expect(flags.state.categories.find(c => c.key === "basic").renderStyle).toBe("side-bar");
	});

	it("each move has selection.value=1 (all basic moves are starting)", async () => {
		const repo = new FakeMoveRepository([], [new TestMoveBuilder().withName("Defy Danger").asStarting().build()]);
		const flags = makeFlags();
		await makeMoves({ repo, flags }).initBasicMoves();
		expect(flags.state.categories.find(c => c.key === "basic").moves[0].selection.value).toBe(1);
	});
});

// ── initPlaybookCategory ──────────────────────────────────────────────────────

describe("CharacterMoves.initPlaybookCategory", () => {
	it("writes a playbook-<slug> category to flags", async () => {
		const flags = makeFlags();
		await makeMoves({ flags }).initPlaybookCategory(makePlaybookData());
		expect(flags.state.categories.some(c => c.key === "playbook-the-heavy")).toBe(true);
	});

	it("starting move gets an ownedId assigned", async () => {
		const repo = new FakeMoveRepository([new TestMoveBuilder().withName("Bulwark").asStarting().build()]);
		const flags = makeFlags();
		const actor = makeActor();
		await makeMoves({ repo, flags, actor }).initPlaybookCategory(makePlaybookData());
		expect(flags.state.categories.find(c => c.key === "playbook-the-heavy").moves.find(m => m.slug === "bulwark").ownedIds).toContain("created-0");
	});

	it("non-starting move has no ownedIds", async () => {
		const repo = new FakeMoveRepository([new TestMoveBuilder().withName("Optional").build()]);
		const flags = makeFlags();
		const actor = makeActor();
		await makeMoves({ repo, flags, actor }).initPlaybookCategory(makePlaybookData());
		expect(flags.state.categories.find(c => c.key === "playbook-the-heavy").moves.find(m => m.slug === "optional").ownedIds).toHaveLength(0);
		expect(actor.createdDocs).toHaveLength(0);
	});

	it("starting move has selection.value=1", async () => {
		const repo = new FakeMoveRepository([new TestMoveBuilder().withName("Bulwark").asStarting().build()]);
		const flags = makeFlags();
		await makeMoves({ repo, flags }).initPlaybookCategory(makePlaybookData());
		expect(flags.state.categories.find(c => c.key === "playbook-the-heavy").moves.find(m => m.slug === "bulwark").selection.value).toBe(1);
	});

	it("non-starting move has selection.value=0", async () => {
		const repo = new FakeMoveRepository([new TestMoveBuilder().withName("Optional").build()]);
		const flags = makeFlags();
		await makeMoves({ repo, flags }).initPlaybookCategory(makePlaybookData());
		expect(flags.state.categories.find(c => c.key === "playbook-the-heavy").moves.find(m => m.slug === "optional").selection.value).toBe(0);
	});

	it("removes existing playbook-* category and deletes its owned docs", async () => {
		// First, init a playbook category to create state with ownedIds
		const repoFox = new FakeMoveRepository([new TestMoveBuilder().withName("Fox Move").asStarting().build()]);
		const flags = makeFlags();
		const actor = makeActor();
		const m = makeMoves({ repo: repoFox, flags, actor });
		await m.initPlaybookCategory({ slug: "the-fox", name: "The Fox", startingMovesNote: null, backgrounds: [] });
		const foxDocId = actor.createdDocs[0]._id;
		// Now switch to a new playbook
		const repoHeavy = new FakeMoveRepository();
		m._moveRepo = repoHeavy;
		await m.initPlaybookCategory(makePlaybookData());
		expect(actor.deletedIds).toContain(foxDocId);
		expect(flags.state.categories.find(c => c.key === "playbook-the-fox")).toBeUndefined();
	});
});

// ── addCategory ───────────────────────────────────────────────────────────────

describe("CharacterMoves.addCategory", () => {
	it("appends the category to flags", async () => {
		const flags = makeFlags();
		await makeMoves({ flags }).addCategory("post-death-revenant", "Revenant", "revenant");
		expect(flags.state.categories.some(c => c.key === "post-death-revenant" && c.label === "Revenant")).toBe(true);
	});

	it("does nothing when category already exists", async () => {
		const repo = new FakeMoveRepository([], [], [new TestMoveBuilder().withName("Haunt").build()]);
		const flags = makeFlags();
		const actor = makeActor();
		const m = makeMoves({ repo, flags, actor });
		await m.addCategory("post-death-revenant", "Revenant", "revenant");
		const countBefore = actor.createdDocs.length;
		await m.addCategory("post-death-revenant", "Revenant", "revenant");
		expect(actor.createdDocs.length).toBe(countBefore);
	});

	it("creates embedded docs and assigns ownedIds", async () => {
		const repo = new FakeMoveRepository([], [], [new TestMoveBuilder().withName("Haunt").build()]);
		const flags = makeFlags();
		const actor = makeActor();
		await makeMoves({ repo, flags, actor }).addCategory("post-death-revenant", "Revenant", "revenant");
		expect(flags.state.categories.find(c => c.key === "post-death-revenant").moves.find(m => m.slug === "haunt").ownedIds).toContain("created-0");
	});

	it("does not create embedded docs when repo returns no moves", async () => {
		const actor = makeActor();
		await makeMoves({ actor }).addCategory("post-death-revenant", "Revenant", "revenant");
		expect(actor.createdDocs).toHaveLength(0);
	});

	it("stored category has renderStyle=standard and allowAdditional=false", async () => {
		const flags = makeFlags();
		await makeMoves({ flags }).addCategory("post-death-revenant", "Revenant", "revenant");
		const cat = flags.state.categories.find(c => c.key === "post-death-revenant");
		expect(cat.renderStyle).toBe("standard");
		expect(cat.allowAdditional).toBe(false);
	});

	it("each move stored has selection.value=1", async () => {
		const repo = new FakeMoveRepository([], [], [new TestMoveBuilder().withName("Haunt").build()]);
		const flags = makeFlags();
		await makeMoves({ repo, flags }).addCategory("post-death-revenant", "Revenant", "revenant");
		expect(flags.state.categories.find(c => c.key === "post-death-revenant").moves[0].selection.value).toBe(1);
	});
});

// ── removeCategory ────────────────────────────────────────────────────────────

describe("CharacterMoves.removeCategory", () => {
	it("removes the category from flags", async () => {
		const repo = new FakeMoveRepository([], [], [new TestMoveBuilder().withName("Haunt").build()]);
		const flags = makeFlags();
		const actor = makeActor();
		const m = makeMoves({ repo, flags, actor });
		await m.addCategory("post-death-revenant", "Revenant", "revenant");
		await m.removeCategory("post-death-revenant");
		expect(flags.state.categories.find(c => c.key === "post-death-revenant")).toBeUndefined();
	});

	it("deletes embedded docs for all ownedIds", async () => {
		const repo = new FakeMoveRepository([], [], [new TestMoveBuilder().withName("Haunt").build()]);
		const flags = makeFlags();
		const actor = makeActor();
		const m = makeMoves({ repo, flags, actor });
		await m.addCategory("post-death-revenant", "Revenant", "revenant");
		const hauntId = actor.createdDocs[0]._id;
		await m.removeCategory("post-death-revenant");
		expect(actor.deletedIds).toContain(hauntId);
	});

	it("does not delete any docs when no ownedIds", async () => {
		const flags = makeFlags();
		const actor = makeActor();
		const m = makeMoves({ flags, actor });
		await m.addCategory("post-death-revenant", "Revenant", "revenant");
		await m.removeCategory("post-death-revenant");
		expect(actor.deletedIds).toHaveLength(0);
	});

	it("does nothing when category does not exist", async () => {
		const actor = makeActor();
		await makeMoves({ actor }).removeCategory("post-death-revenant");
		expect(actor.deletedIds).toHaveLength(0);
	});

	it("category is gone from subsequent buildSnapshot", async () => {
		const flags = makeFlags();
		const m = makeMoves({ flags });
		await m.addCategory("post-death-revenant", "Revenant", "revenant");
		await m.removeCategory("post-death-revenant");
		expect((await m.buildSnapshot()).categories.find(c => c.key === "post-death-revenant")).toBeUndefined();
	});
});

// ── incrementMove ─────────────────────────────────────────────────────────────

describe("CharacterMoves.incrementMove", () => {
	it("increments selection.value in flags", async () => {
		const repo = new FakeMoveRepository([new TestMoveBuilder().withName("Alpha").withRepeatMax(2).build()]);
		const flags = makeFlags();
		const m = makeMoves({ repo, flags });
		await m.initPlaybookCategory(makePlaybookData());
		await m.incrementMove("playbook-the-heavy", "alpha");
		expect(flags.state.categories.find(c => c.key === "playbook-the-heavy").moves.find(m => m.slug === "alpha").selection.value).toBe(1);
	});

	it("does nothing when already at max", async () => {
		const repo = new FakeMoveRepository([new TestMoveBuilder().withName("Alpha").asStarting().build()]);
		const flags = makeFlags();
		const actor = makeActor();
		const m = makeMoves({ repo, flags, actor });
		await m.initPlaybookCategory(makePlaybookData());
		const docsBefore = actor.createdDocs.length;
		await m.incrementMove("playbook-the-heavy", "alpha");
		expect(actor.createdDocs.length).toBe(docsBefore);
	});

	it("assigns a new ownedId after creating embedded doc", async () => {
		const repo = new FakeMoveRepository([new TestMoveBuilder().withName("Alpha").withRepeatMax(2).build()]);
		const flags = makeFlags();
		const actor = makeActor();
		const m = makeMoves({ repo, flags, actor });
		await m.initPlaybookCategory(makePlaybookData());
		await m.incrementMove("playbook-the-heavy", "alpha");
		expect(flags.state.categories.find(c => c.key === "playbook-the-heavy").moves.find(m => m.slug === "alpha").ownedIds).toHaveLength(1);
	});
});

// ── decrementMove ─────────────────────────────────────────────────────────────

describe("CharacterMoves.decrementMove", () => {
	it("decrements selection.value in flags", async () => {
		const repo = new FakeMoveRepository([new TestMoveBuilder().withName("Alpha").asStarting().withRepeatMax(2).build()]);
		const flags = makeFlags();
		const actor = makeActor();
		const m = makeMoves({ repo, flags, actor });
		await m.initPlaybookCategory(makePlaybookData());
		await m.incrementMove("playbook-the-heavy", "alpha");
		await m.decrementMove("playbook-the-heavy", "alpha");
		expect(flags.state.categories.find(c => c.key === "playbook-the-heavy").moves.find(m => m.slug === "alpha").selection.value).toBe(1);
	});

	it("deletes the last owned embedded doc", async () => {
		const repo = new FakeMoveRepository([new TestMoveBuilder().withName("Alpha").asStarting().withRepeatMax(2).build()]);
		const flags = makeFlags();
		const actor = makeActor();
		const m = makeMoves({ repo, flags, actor });
		await m.initPlaybookCategory(makePlaybookData());
		await m.incrementMove("playbook-the-heavy", "alpha");
		const idToDelete = actor.createdDocs.at(-1)._id;
		await m.decrementMove("playbook-the-heavy", "alpha");
		expect(actor.deletedIds).toContain(idToDelete);
	});

	it("does nothing when value is already 0", async () => {
		const repo = new FakeMoveRepository([new TestMoveBuilder().withName("Alpha").build()]);
		const flags = makeFlags();
		const actor = makeActor();
		const m = makeMoves({ repo, flags, actor });
		await m.initPlaybookCategory(makePlaybookData());
		await m.decrementMove("playbook-the-heavy", "alpha");
		expect(actor.deletedIds).toHaveLength(0);
		expect(flags.state.categories[0].moves[0].selection.value).toBe(0);
	});

	it("does not decrement below 1 when isStarting", async () => {
		const repo = new FakeMoveRepository([new TestMoveBuilder().withName("Alpha").asStarting().build()]);
		const flags = makeFlags();
		const actor = makeActor();
		const m = makeMoves({ repo, flags, actor });
		await m.initPlaybookCategory(makePlaybookData());
		const idsBefore = [...actor.deletedIds];
		await m.decrementMove("playbook-the-heavy", "alpha");
		expect(actor.deletedIds).toEqual(idsBefore);
		expect(flags.state.categories[0].moves[0].selection.value).toBe(1);
	});
});

// ── addMoveToOther ────────────────────────────────────────────────────────────

describe("CharacterMoves.addMoveToOther", () => {
	it("returns true and adds move to other category", async () => {
		const flags = makeFlags();
		const result = await makeMoves({ flags }).addMoveToOther({ name: "Custom Move", system: {} });
		expect(result).toBe(true);
		expect(flags.state.categories.find(c => c.key === "other").moves.find(m => m.slug === "custom-move")).toBeDefined();
	});

	it("creates the other category if it does not exist", async () => {
		const flags = makeFlags();
		await makeMoves({ flags }).addMoveToOther({ name: "Custom Move", system: {} });
		expect(flags.state.categories.find(c => c.key === "other")).toBeDefined();
	});

	it("other category has allowAdditional=true", async () => {
		const flags = makeFlags();
		await makeMoves({ flags }).addMoveToOther({ name: "Custom Move", system: {} });
		expect(flags.state.categories.find(c => c.key === "other").allowAdditional).toBe(true);
	});

	it("returns false when move with same name already in other", async () => {
		const flags = makeFlags();
		const actor = makeActor();
		const m = makeMoves({ flags, actor });
		await m.addMoveToOther({ name: "Custom Move", system: {} });
		const docsBefore = actor.createdDocs.length;
		const result = await m.addMoveToOther({ name: "Custom Move", system: {} });
		expect(result).toBe(false);
		expect(actor.createdDocs.length).toBe(docsBefore);
	});

	it("assigns an ownedId after creating embedded doc", async () => {
		const flags = makeFlags();
		const actor = makeActor();
		await makeMoves({ flags, actor }).addMoveToOther({ name: "Custom Move", system: { rollType: "str" } });
		expect(flags.state.categories.find(c => c.key === "other").moves.find(m => m.slug === "custom-move").ownedIds).toContain("created-0");
	});
});

// ── deleteMove ────────────────────────────────────────────────────────────────

describe("CharacterMoves.deleteMove", () => {
	it("removes the move from the other category", async () => {
		const flags = makeFlags();
		const m = makeMoves({ flags });
		await m.addMoveToOther({ name: "To Delete", system: {} });
		await m.deleteMove("to-delete");
		expect(flags.state.categories.find(c => c.key === "other").moves.find(m => m.slug === "to-delete")).toBeUndefined();
	});

	it("deletes embedded docs", async () => {
		const flags = makeFlags();
		const actor = makeActor();
		const m = makeMoves({ flags, actor });
		await m.addMoveToOther({ name: "To Delete", system: {} });
		const docId = actor.createdDocs[0]._id;
		await m.deleteMove("to-delete");
		expect(actor.deletedIds).toContain(docId);
	});

	it("does nothing when move not found", async () => {
		const actor = makeActor();
		await makeMoves({ actor }).deleteMove("nonexistent");
		expect(actor.deletedIds).toHaveLength(0);
	});
});

// ── setMoveResourceCurrent ────────────────────────────────────────────────────

describe("CharacterMoves.setMoveResourceCurrent", () => {
	it("persists current to ResourceController by move slug", async () => {
		const resFlags = makeFlags();
		await makeMoves({ resFlags }).setMoveResourceCurrent("bulwark", 2);
		expect(resFlags.state.counts?.moves?.bulwark).toBe(2);
	});

	it("persists current regardless of whether move has a resource definition", async () => {
		const resFlags = makeFlags();
		await makeMoves({ resFlags }).setMoveResourceCurrent("no-resource", 5);
		expect(resFlags.state.counts?.moves?.["no-resource"]).toBe(5);
	});
});

// ── onDropMove ────────────────────────────────────────────────────────────────

describe("CharacterMoves.onDropMove", () => {
	it("increments selection for existing playbook move", async () => {
		const repo = new FakeMoveRepository([new TestMoveBuilder().withName("Bulwark").withRepeatMax(2).build()]);
		const flags = makeFlags();
		const actor = makeActor();
		const m = makeMoves({ repo, flags, actor });
		await m.initPlaybookCategory(makePlaybookData());
		const result = await m.onDropMove({ name: "Bulwark", system: {} });
		expect(result).toBe(true);
		expect(flags.state.categories.find(c => c.key === "playbook-the-heavy").moves.find(m => m.slug === "bulwark").ownedIds).toHaveLength(1);
	});

	it("returns false when playbook move is already at max selection", async () => {
		const repo = new FakeMoveRepository([new TestMoveBuilder().withName("Bulwark").asStarting().build()]);
		const flags = makeFlags();
		const actor = makeActor();
		const m = makeMoves({ repo, flags, actor });
		await m.initPlaybookCategory(makePlaybookData());
		const docsBefore = actor.createdDocs.length;
		const result = await m.onDropMove({ name: "Bulwark", system: {} });
		expect(result).toBe(false);
		expect(actor.createdDocs.length).toBe(docsBefore);
	});

	it("adds unknown move to other category", async () => {
		const flags = makeFlags();
		const result = await makeMoves({ flags }).onDropMove({ name: "Stranger Move", system: {} });
		expect(result).toBe(true);
		expect(flags.state.categories.find(c => c.key === "other")).toBeDefined();
	});
});

// ── countOwnedBySlug ──────────────────────────────────────────────────────────

describe("CharacterMoves.countOwnedBySlug", () => {
	it("returns 0 when no categories exist", () => { expect(makeMoves().countOwnedBySlug("bulwark")).toBe(0); });

	it("returns 0 when move exists but not acquired", async () => {
		const repo = new FakeMoveRepository([new TestMoveBuilder().withName("Bulwark").build()]);
		const m = makeMoves({ repo });
		await m.initPlaybookCategory(makePlaybookData());
		expect(m.countOwnedBySlug("bulwark")).toBe(0);
	});

	it("returns selection.value when move is acquired", async () => {
		const repo = new FakeMoveRepository([new TestMoveBuilder().withName("Bulwark").asStarting().withRepeatMax(2).build()]);
		const flags = makeFlags();
		const actor = makeActor();
		const m = makeMoves({ repo, flags, actor });
		await m.initPlaybookCategory(makePlaybookData());
		await m.incrementMove("playbook-the-heavy", "bulwark");
		expect(m.countOwnedBySlug("bulwark")).toBe(2);
	});

	it("returns 0 when slug does not match any move", async () => {
		const repo = new FakeMoveRepository([new TestMoveBuilder().withName("Alpha").build()]);
		const m = makeMoves({ repo });
		await m.initPlaybookCategory(makePlaybookData());
		expect(m.countOwnedBySlug("bulwark")).toBe(0);
	});
});

// ── setMoveChoiceText / setMoveChoiceCount ────────────────────────────────────

const CHOICES_DATA = new TestChoiceGroupBuilder()
	.withSlug("potential")
	.addChoice(
		TestChoiceRowBuilder.heading()
			.withSlug("stat1")
			.withLabel("Increase the stat you rolled by 1")
			.withTrack(1)
			.withInput("level checked")
	)
	.build();

describe("CharacterMoves.setMoveChoiceText", () => {
	it("persists via ChoiceGroupController keyed by move slug", async () => {
		const flags = makeFlags();
		await makeMoves({ flags }).setMoveChoiceText("potential-for-greatness", "stat1-input", "2");
		expect(flags.state.values).toEqual({ "potential-for-greatness": { "stat1-input": "2" } });
	});
});

describe("CharacterMoves.setMoveChoiceCount", () => {
	it("persists via ChoiceGroupController keyed by move slug", async () => {
		const flags = makeFlags();
		await makeMoves({ flags }).setMoveChoiceCount("potential-for-greatness", "stat1", 1);
		expect(flags.state.values).toEqual({ "potential-for-greatness": { "stat1": 1 } });
	});
});

// ── buildSnapshot — choices ───────────────────────────────────────────────────

describe("CharacterMoves.buildSnapshot — choices", () => {
	it("choices is null when repo has no choices for move", async () => {
		const repo = new FakeMoveRepository([new TestMoveBuilder().withName("Alpha").build()]);
		const m = makeMoves({ repo });
		await m.initPlaybookCategory(makePlaybookData());
		expect((await m.buildSnapshot()).categories[0].moves[0].choices).toBeNull();
	});

	it("choices is a ChoiceGroup when repo move has choices", async () => {
		const repo = new FakeMoveRepository([new TestMoveBuilder().withName("Potential for Greatness").withChoices(CHOICES_DATA).build()]);
		const m = makeMoves({ repo });
		await m.initPlaybookCategory(makePlaybookData());
		const snap = (await m.buildSnapshot()).categories[0].moves[0];
		expect(snap.choices).toBeInstanceOf(ChoiceGroup);
		expect(snap.choices.list).toHaveLength(CHOICES_DATA.list.length);
	});

	it("HeadingRow.input reflects saved text value from ChoiceGroupController", async () => {
		const repo = new FakeMoveRepository([new TestMoveBuilder().withName("Potential for Greatness").withChoices(CHOICES_DATA).build()]);
		const flags = makeFlags({ values: { "potential-for-greatness": { "stat1-input": "level 2" } } });
		const m = makeMoves({ repo, flags });
		await m.initPlaybookCategory(makePlaybookData());
		const row = (await m.buildSnapshot()).categories[0].moves[0].choices.list.find(r => r.slug === "stat1");
		expect(row.input.value).toBe("level 2");
		expect(row.input.slug).toBe("stat1-input");
		expect(row.input.placeholder).toBe("level checked");
	});

	it("HeadingRow track reflects saved count from ChoiceGroupController", async () => {
		const repo = new FakeMoveRepository([new TestMoveBuilder().withName("Potential for Greatness").withChoices(CHOICES_DATA).build()]);
		const flags = makeFlags({ values: { "potential-for-greatness": { "stat1": 1 } } });
		const m = makeMoves({ repo, flags });
		await m.initPlaybookCategory(makePlaybookData());
		const row = (await m.buildSnapshot()).categories[0].moves[0].choices.list.find(r => r.slug === "stat1");
		expect(row.track.checks[0]).toBe(true);
	});
});
