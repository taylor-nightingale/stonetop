import {describe, expect, it} from "vitest";
import {CharacterMoves} from "../../../src/actors/character/CharacterMoves.js";
import {ChoiceGroupFactory} from "../../../src/actors/character/ChoiceGroupFactory.js";
import {ResourceController} from "../../../src/actors/character/ResourceController.js";
import {FakeMoveRepository} from "../../fakes/FakeMoveRepository.js";
import {FakeActorBuilder} from "../../fakes/FakeActorBuilder.js";
import {FakeCompendiumMoveBuilder} from "../../fakes/FakeCompendiumMoveBuilder.js";
import {TestChoiceGroupBuilder} from "../../fakes/TestChoiceGroupBuilder.js";
import {TestChoiceRowBuilder} from "../../fakes/TestChoiceRowBuilder.js";
import {
	ChoiceGroup,
	MoveCategorySnapshot,
	Movelist,
	MoveSnapshot,
	ValueMax,
} from "../../../src/model/snapshot/character/CharacterSnapshot.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const CHOICES_DATA = new TestChoiceGroupBuilder()
	.withSlug("potential")
	.addChoice(
		TestChoiceRowBuilder.heading()
			.withSlug("stat1")
			.withContentText("Increase the stat you rolled by 1")
			.withTrack(1)
			.withInput("level checked")
	)
	.build();

function makeActor() { return new FakeActorBuilder().build(); }

function makeMoves({
	repo   = new FakeMoveRepository(),
	actor  = makeActor(),
	vitals = {level: 1},
} = {}) {
	const res = new ResourceController(actor);
	const m   = new CharacterMoves(repo, actor, res, new ChoiceGroupFactory(actor));
	m.setVitals(vitals);
	return m;
}

function makePlaybookData(overrides = {}) {
	return {slug: "the-heavy", name: "The Heavy", startingMovesNote: null, backgrounds: [], ...overrides};
}

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
		const repo = new FakeMoveRepository([], [new FakeCompendiumMoveBuilder().withName("Defy Danger").asStarting().build()]);
		const m = makeMoves({repo});
		await m.initBasicMoves();
		const result = await m.buildSnapshot();
		expect(result.categories).toHaveLength(1);
		expect(result.categories[0]).toBeInstanceOf(MoveCategorySnapshot);
	});

	it("category key, label, renderStyle, allowAdditional, note come from initPlaybookCategory data", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Bulwark").asStarting().build()]);
		const m = makeMoves({repo});
		await m.initPlaybookCategory(makePlaybookData({startingMovesNote: "Pick 2."}));
		const cat = (await m.buildSnapshot()).categories[0];
		expect(cat.key).toBe("playbook-the-heavy");
		expect(cat.label).toBe("The Heavy");
		expect(cat.renderStyle).toBe("standard");
		expect(cat.allowAdditional).toBe(false);
		expect(cat.note).toBe("Pick 2.");
	});

	it("each move becomes a MoveSnapshot", async () => {
		const repo = new FakeMoveRepository([], [new FakeCompendiumMoveBuilder().withName("Defy Danger").asStarting().build()]);
		const m = makeMoves({repo});
		await m.initBasicMoves();
		expect((await m.buildSnapshot()).categories[0].moves[0]).toBeInstanceOf(MoveSnapshot);
	});

	it("move selection reflects acquired state", async () => {
		const repo = new FakeMoveRepository([], [new FakeCompendiumMoveBuilder().withName("Defy Danger").asStarting().build()]);
		const m = makeMoves({repo});
		await m.initBasicMoves();
		const snap = (await m.buildSnapshot()).categories[0].moves[0];
		expect(snap.selection).toBeInstanceOf(ValueMax);
		expect(snap.selection.value).toBe(1);
		expect(snap.selection.max).toBe(1);
	});

	it("move ownedId is the doc created at initPlaybookCategory, unchanged after increment", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Bulwark").asStarting().withRepeatMax(2).build()]);
		const actor = makeActor();
		const m = makeMoves({repo, actor});
		await m.initPlaybookCategory(makePlaybookData());
		const initDocId = actor.createdDocs[0]._id;
		await m.incrementMove("playbook-the-heavy", "bulwark");
		expect((await m.buildSnapshot()).categories[0].moves[0].ownedId).toBe(initDocId);
	});

	it("move ownedId is set even when not acquired (embedded at init with acquired=false)", async () => {
		const repo  = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Optional").build()]);
		const actor = makeActor();
		const m     = makeMoves({repo, actor});
		await m.initPlaybookCategory(makePlaybookData());
		expect((await m.buildSnapshot()).categories[0].moves[0].ownedId).toBe(actor.createdDocs[0]._id);
	});

	it("move resource is null when repo has no resource definition", async () => {
		const repo = new FakeMoveRepository([], [new FakeCompendiumMoveBuilder().withName("Defy Danger").asStarting().build()]);
		const m = makeMoves({repo});
		await m.initBasicMoves();
		expect((await m.buildSnapshot()).categories[0].moves[0].resource).toBeNull();
	});

	it("resource definition comes from repo, current from ResourceController", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Bulwark").asStarting().withResource({max: 3, title: "Favor", labels: []}).build()]);
		const m = makeMoves({repo});
		await m.initPlaybookCategory(makePlaybookData());
		await m.setMoveResourceCurrent("bulwark", 2);
		const snap = (await m.buildSnapshot()).categories[0].moves[0];
		expect(snap.resource.max).toBe(3);
		expect(snap.resource.current).toBe(2);
	});

	it("selection.value reflects instanceCount on embedded item after increment", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Alpha").withRepeatMax(2).build()]);
		const m    = makeMoves({repo});
		await m.initPlaybookCategory(makePlaybookData());
		await m.incrementMove("playbook-the-heavy", "alpha");
		expect((await m.buildSnapshot()).categories[0].moves[0].selection.value).toBe(1);
	});

	it("buildSnapshot derives categories from actor.items when system.moves is empty", async () => {
		const actor = new FakeActorBuilder().build();
		actor.items.push({ _id: "m1", name: "Defy Danger", type: "move",
			system: { categoryKey: "basic", acquired: true, instanceCount: 1, repeatMax: 1, sortOrder: 0, isStartingMove: true } });
		const m = makeMoves({ actor });
		const snap = await m.buildSnapshot();
		expect(snap.categories).toHaveLength(1);
		expect(snap.categories[0].key).toBe("basic");
		expect(snap.categories[0].moves[0].name).toBe("Defy Danger");
	});
});

// ── buildSnapshot — repo enrichment ──────────────────────────────────────────

describe("CharacterMoves.buildSnapshot — repo enrichment", () => {
	it("name and description come from repo move", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Potential for Greatness").withDescription("<p>Once per level…</p>").build()]);
		const m = makeMoves({repo});
		await m.initPlaybookCategory(makePlaybookData());
		const snap = (await m.buildSnapshot()).categories[0].moves[0];
		expect(snap.name).toBe("Potential for Greatness");
		expect(snap.description).toBe("<p>Once per level…</p>");
	});

	it("choices from repo renders as ChoiceGroup", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Potential for Greatness").withChoices(CHOICES_DATA).build()]);
		const m = makeMoves({repo});
		await m.initPlaybookCategory(makePlaybookData());
		const snap = (await m.buildSnapshot()).categories[0].moves[0];
		expect(snap.choices).toBeInstanceOf(ChoiceGroup);
		expect(snap.choices.list).toHaveLength(CHOICES_DATA.list.length);
	});

	it("selection.value comes from flag state (acquired), not repo", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Alpha").asStarting().build()]);
		const m = makeMoves({repo});
		await m.initPlaybookCategory(makePlaybookData());
		expect((await m.buildSnapshot()).categories[0].moves[0].selection.value).toBe(1);
	});

	it("slug not in repo: choices and requirement are null", async () => {
		const m = makeMoves();
		await m.addMoveToOther({name: "Mystery Move", system: {}});
		const snap = (await m.buildSnapshot()).categories[0].moves[0];
		expect(snap.choices).toBeNull();
		expect(snap.requirement).toBeNull();
	});

	it("reads move data from embedded item, not live repo", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Bulwark").withDescription("Sturdy.").build()]);
		const m    = makeMoves({repo});
		await m.initPlaybookCategory(makePlaybookData());
		m._moveRepo = new FakeMoveRepository();
		const snap  = (await m.buildSnapshot()).categories[0].moves[0];
		expect(snap.name).toBe("Bulwark");
		expect(snap.description).toBe("Sturdy.");
	});
});

// ── buildSnapshot — requiresLabel ─────────────────────────────────────────────

describe("CharacterMoves.buildSnapshot — requiresLabel", () => {
	async function snapMove(builder) {
		const repo = new FakeMoveRepository([builder.build()]);
		const m = makeMoves({repo});
		await m.initPlaybookCategory(makePlaybookData());
		return (await m.buildSnapshot()).categories[0].moves[0];
	}

	it("requiresLabel is null when no requirement", async () => {
		expect((await snapMove(new FakeCompendiumMoveBuilder().withName("Alpha"))).requiresLabel).toBeNull();
	});

	it("requiresLabel is 'Level N' when only a level requirement", async () => {
		expect((await snapMove(new FakeCompendiumMoveBuilder().withName("Alpha").withRequirement({moves: [], level: 6, playbook: null}))).requiresLabel).toBe("Level 6");
	});

	it("requiresLabel lists required move names", async () => {
		expect((await snapMove(new FakeCompendiumMoveBuilder().withName("Alpha").withRequirement({moves: ["Wild Speech", "Spirit Tongue"], level: null, playbook: null}))).requiresLabel).toBe("Wild Speech, Spirit Tongue");
	});

	it("requiresLabel combines moves and level", async () => {
		expect((await snapMove(new FakeCompendiumMoveBuilder().withName("Alpha").withRequirement({moves: ["Wild Speech"], level: 6, playbook: null}))).requiresLabel).toBe("Wild Speech, Level 6");
	});

	it("requiresLabel is null when requirement has only playbook field", async () => {
		expect((await snapMove(new FakeCompendiumMoveBuilder().withName("Alpha").withRequirement({moves: [], level: null, playbook: "The Ranger"}))).requiresLabel).toBeNull();
	});
});

// ── buildSnapshot — selectable computation ────────────────────────────────────

describe("CharacterMoves.buildSnapshot — selectable computation", () => {
	it("selectable=false when acquired count equals max", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Alpha").asStarting().build()]);
		const m = makeMoves({repo});
		await m.initPlaybookCategory(makePlaybookData());
		expect((await m.buildSnapshot()).categories[0].moves[0].selectable).toBe(false);
	});

	it("selectable=true when acquired count is below max", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Alpha").withRepeatMax(2).build()]);
		const m = makeMoves({repo});
		await m.initPlaybookCategory(makePlaybookData());
		expect((await m.buildSnapshot()).categories[0].moves[0].selectable).toBe(true);
	});

	it("requirement.met=false when level requirement exceeds actor level", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Alpha").withRequirement({moves: [], level: 6, playbook: null}).build()]);
		const m = makeMoves({repo, vitals: {level: 1}});
		await m.initPlaybookCategory(makePlaybookData());
		const move = (await m.buildSnapshot()).categories[0].moves[0];
		expect(move.selectable).toBe(true);
		expect(move.requirement.met).toBe(false);
	});

	it("requirement.met=true when level requirement equals actor level", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Alpha").withRequirement({moves: [], level: 3, playbook: null}).build()]);
		const m = makeMoves({repo, vitals: {level: 3}});
		await m.initPlaybookCategory(makePlaybookData());
		const move = (await m.buildSnapshot()).categories[0].moves[0];
		expect(move.selectable).toBe(true);
		expect(move.requirement.met).toBe(true);
	});

	it("requirement.met=false when required move not yet acquired", async () => {
		const repo = new FakeMoveRepository([
			new FakeCompendiumMoveBuilder().withName("Parent").build(),
			new FakeCompendiumMoveBuilder().withName("Child").withRequirement({moves: ["Parent"], level: null, playbook: null}).build(),
		]);
		const m = makeMoves({repo});
		await m.initPlaybookCategory(makePlaybookData());
		const moves = (await m.buildSnapshot()).categories[0].moves;
		const child = moves.find(mv => mv.slug === "child");
		expect(child.selectable).toBe(true);
		expect(child.requirement.met).toBe(false);
	});

	it("requirement.met=true when required move is acquired", async () => {
		const repo = new FakeMoveRepository([
			new FakeCompendiumMoveBuilder().withName("Parent").asStarting().build(),
			new FakeCompendiumMoveBuilder().withName("Child").withRequirement({moves: ["Parent"], level: null, playbook: null}).build(),
		]);
		const m = makeMoves({repo});
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
		expect(await makeMoves().getMoveSnapshotsForCategory("insert-revenant")).toHaveLength(0);
	});

	it("returns MoveSnapshot with name from repo", async () => {
		const repo = new FakeMoveRepository([], [], [new FakeCompendiumMoveBuilder().withName("Haunt").build()]);
		const m = makeMoves({repo});
		await m.addCategory("insert-revenant", "Revenant", "revenant");
		const snaps = await m.getMoveSnapshotsForCategory("insert-revenant");
		expect(snaps).toHaveLength(1);
		expect(snaps[0]).toBeInstanceOf(MoveSnapshot);
		expect(snaps[0].name).toBe("Haunt");
	});

	it("returned snapshot has correct source.type", async () => {
		const repo = new FakeMoveRepository([], [], [new FakeCompendiumMoveBuilder().withName("Haunt").build()]);
		const m = makeMoves({repo});
		await m.addCategory("insert-revenant", "Revenant", "revenant");
		expect((await m.getMoveSnapshotsForCategory("insert-revenant"))[0].source.type).toBe("insert-revenant");
	});

	it("reads move data from embedded item, not live repo", async () => {
		const repo = new FakeMoveRepository([], [], [new FakeCompendiumMoveBuilder().withName("Haunt").build()]);
		const m    = makeMoves({repo});
		await m.addCategory("insert-revenant", "Revenant", "revenant");
		m._moveRepo = new FakeMoveRepository();
		const snaps = await m.getMoveSnapshotsForCategory("insert-revenant");
		expect(snaps[0].name).toBe("Haunt");
	});
});

// ── initBasicMoves ────────────────────────────────────────────────────────────

describe("CharacterMoves.initBasicMoves", () => {
	it("does nothing when basic category already exists", async () => {
		const repo = new FakeMoveRepository([], [new FakeCompendiumMoveBuilder().withName("Defy Danger").asStarting().build()]);
		const actor = makeActor();
		const m = makeMoves({repo, actor});
		await m.initBasicMoves();
		const firstLen = actor.createdDocs.length;
		await m.initBasicMoves();
		expect(actor.createdDocs.length).toBe(firstLen);
		expect((await m.buildSnapshot()).categories).toHaveLength(1);
	});

	it("creates embedded docs and assigns ownedId", async () => {
		const repo = new FakeMoveRepository([], [new FakeCompendiumMoveBuilder().withName("Defy Danger").asStarting().build()]);
		const actor = makeActor();
		const m = makeMoves({repo, actor});
		await m.initBasicMoves();
		expect((await m.buildSnapshot()).categories[0].moves[0].ownedId).toBe(actor.createdDocs[0]._id);
	});

	it("created item has categoryKey='basic', acquired=true, instanceCount=1", async () => {
		const repo = new FakeMoveRepository([], [new FakeCompendiumMoveBuilder().withName("Defy Danger").asStarting().build()]);
		const actor = makeActor();
		await makeMoves({repo, actor}).initBasicMoves();
		expect(actor.createdDocs[0].system.categoryKey).toBe("basic");
		expect(actor.createdDocs[0].system.acquired).toBe(true);
		expect(actor.createdDocs[0].system.instanceCount).toBe(1);
	});

	it("writes a basic category with side-bar renderStyle", async () => {
		const repo = new FakeMoveRepository([], [new FakeCompendiumMoveBuilder().withName("Defy Danger").asStarting().build()]);
		const m = makeMoves({repo});
		await m.initBasicMoves();
		expect((await m.buildSnapshot()).categories[0].renderStyle).toBe("side-bar");
	});

	it("each move has selection.value=1 (all basic moves are starting)", async () => {
		const repo = new FakeMoveRepository([], [new FakeCompendiumMoveBuilder().withName("Defy Danger").asStarting().build()]);
		const m = makeMoves({repo});
		await m.initBasicMoves();
		expect((await m.buildSnapshot()).categories[0].moves[0].selection.value).toBe(1);
	});

	it("incrementally adds new world move when basic category already exists", async () => {
		const repo  = new FakeMoveRepository([], [new FakeCompendiumMoveBuilder().withName("Defy Danger").asStarting().build()]);
		const actor = makeActor();
		const m     = makeMoves({repo, actor});
		await m.initBasicMoves();

		repo.addWorld(new FakeCompendiumMoveBuilder().withName("Aid or Interfere").withMoveType("basic").asStarting().build());
		await m.initBasicMoves();

		const cat = (await m.buildSnapshot()).categories.find(c => c.key === "basic");
		expect(cat.moves.some(mv => mv.name === "Aid or Interfere")).toBe(true);
		expect(cat.moves.some(mv => mv.name === "Defy Danger")).toBe(true);
	});

	it("does not create duplicate docs for existing moves when called again with new world move", async () => {
		const repo  = new FakeMoveRepository([], [new FakeCompendiumMoveBuilder().withName("Defy Danger").asStarting().build()]);
		const actor = makeActor();
		const m     = makeMoves({repo, actor});
		await m.initBasicMoves();
		const docsAfterFirst = actor.createdDocs.length;

		repo.addWorld(new FakeCompendiumMoveBuilder().withName("Aid or Interfere").withMoveType("basic").asStarting().build());
		await m.initBasicMoves();

		expect(actor.createdDocs.length).toBe(docsAfterFirst + 1);
	});
});

// ── initPlaybookCategory ──────────────────────────────────────────────────────

describe("CharacterMoves.initPlaybookCategory", () => {
	it("creates a playbook-<slug> category", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Bulwark").asStarting().build()]);
		const m = makeMoves({repo});
		await m.initPlaybookCategory(makePlaybookData());
		expect((await m.buildSnapshot()).categories.some(c => c.key === "playbook-the-heavy")).toBe(true);
	});

	it("starting move gets an ownedId assigned", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Bulwark").asStarting().build()]);
		const actor = makeActor();
		const m = makeMoves({repo, actor});
		await m.initPlaybookCategory(makePlaybookData());
		expect((await m.buildSnapshot()).categories[0].moves[0].ownedId).toBe(actor.createdDocs[0]._id);
	});

	it("starting move item has correct categoryKey, acquired, instanceCount", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Bulwark").asStarting().build()]);
		const actor = makeActor();
		await makeMoves({repo, actor}).initPlaybookCategory(makePlaybookData());
		expect(actor.createdDocs[0].system.categoryKey).toBe("playbook-the-heavy");
		expect(actor.createdDocs[0].system.acquired).toBe(true);
		expect(actor.createdDocs[0].system.instanceCount).toBe(1);
	});

	it("non-starting move gets an ownedId assigned", async () => {
		const repo  = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Optional").build()]);
		const actor = makeActor();
		const m     = makeMoves({repo, actor});
		await m.initPlaybookCategory(makePlaybookData());
		expect(actor.createdDocs).toHaveLength(1);
		expect((await m.buildSnapshot()).categories[0].moves[0].ownedId).toBe(actor.createdDocs[0]._id);
	});

	it("non-starting move item has acquired=false and instanceCount=0", async () => {
		const repo  = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Optional").build()]);
		const actor = makeActor();
		await makeMoves({repo, actor}).initPlaybookCategory(makePlaybookData());
		expect(actor.createdDocs[0].system.acquired).toBe(false);
		expect(actor.createdDocs[0].system.instanceCount).toBe(0);
	});

	it("embedded move item has full move data (moveResults)", async () => {
		const moveResults = { success: { label: "10+", value: "Yes!" }, partial: { label: "7-9", value: "Mostly." }, failure: { label: "6-", value: "No." } };
		const repo  = new FakeMoveRepository([
			new FakeCompendiumMoveBuilder().withName("Bulwark").asStarting().withMoveResults(moveResults).build(),
		]);
		const actor = makeActor();
		await makeMoves({repo, actor}).initPlaybookCategory(makePlaybookData());
		expect(actor.createdDocs[0].system.moveResults).toEqual(moveResults);
	});

	it("starting move has selection.value=1", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Bulwark").asStarting().build()]);
		const m = makeMoves({repo});
		await m.initPlaybookCategory(makePlaybookData());
		expect((await m.buildSnapshot()).categories[0].moves[0].selection.value).toBe(1);
	});

	it("non-starting move has selection.value=0", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Optional").build()]);
		const m = makeMoves({repo});
		await m.initPlaybookCategory(makePlaybookData());
		expect((await m.buildSnapshot()).categories[0].moves[0].selection.value).toBe(0);
	});

	it("removes existing playbook-* category and deletes its owned docs", async () => {
		const repoFox = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Fox Move").asStarting().build()]);
		const actor = makeActor();
		const m = makeMoves({repo: repoFox, actor});
		await m.initPlaybookCategory({slug: "the-fox", name: "The Fox", startingMovesNote: null, backgrounds: []});
		const foxDocId = actor.createdDocs[0]._id;
		m._moveRepo = new FakeMoveRepository();
		await m.initPlaybookCategory(makePlaybookData());
		expect(actor.deletedIds).toContain(foxDocId);
		expect((await m.buildSnapshot()).categories.find(c => c.key === "playbook-the-fox")).toBeUndefined();
	});
});

// ── addCategory ───────────────────────────────────────────────────────────────

describe("CharacterMoves.addCategory", () => {
	it("appends the category", async () => {
		const repo = new FakeMoveRepository([], [], [new FakeCompendiumMoveBuilder().withName("Haunt").build()]);
		const m = makeMoves({repo});
		await m.addCategory("insert-revenant", "Revenant", "revenant");
		expect((await m.buildSnapshot()).categories.some(c => c.key === "insert-revenant" && c.label === "Revenant")).toBe(true);
	});

	it("does nothing when category already exists", async () => {
		const repo = new FakeMoveRepository([], [], [new FakeCompendiumMoveBuilder().withName("Haunt").build()]);
		const actor = makeActor();
		const m = makeMoves({repo, actor});
		await m.addCategory("insert-revenant", "Revenant", "revenant");
		const countBefore = actor.createdDocs.length;
		await m.addCategory("insert-revenant", "Revenant", "revenant");
		expect(actor.createdDocs.length).toBe(countBefore);
	});

	it("creates embedded docs and assigns ownedId", async () => {
		const repo = new FakeMoveRepository([], [], [new FakeCompendiumMoveBuilder().withName("Haunt").build()]);
		const actor = makeActor();
		const m = makeMoves({repo, actor});
		await m.addCategory("insert-revenant", "Revenant", "revenant");
		expect((await m.buildSnapshot()).categories[0].moves[0].ownedId).toBe(actor.createdDocs[0]._id);
	});

	it("created item has correct categoryKey, acquired, instanceCount", async () => {
		const repo = new FakeMoveRepository([], [], [new FakeCompendiumMoveBuilder().withName("Haunt").build()]);
		const actor = makeActor();
		await makeMoves({repo, actor}).addCategory("insert-revenant", "Revenant", "revenant");
		expect(actor.createdDocs[0].system.categoryKey).toBe("insert-revenant");
		expect(actor.createdDocs[0].system.acquired).toBe(true);
		expect(actor.createdDocs[0].system.instanceCount).toBe(1);
	});

	it("does not create embedded docs when repo returns no moves", async () => {
		const actor = makeActor();
		await makeMoves({actor}).addCategory("insert-revenant", "Revenant", "revenant");
		expect(actor.createdDocs).toHaveLength(0);
	});

	it("stored category has renderStyle=standard and allowAdditional=false", async () => {
		const repo = new FakeMoveRepository([], [], [new FakeCompendiumMoveBuilder().withName("Haunt").build()]);
		const m = makeMoves({repo});
		await m.addCategory("insert-revenant", "Revenant", "revenant");
		const cat = (await m.buildSnapshot()).categories.find(c => c.key === "insert-revenant");
		expect(cat.renderStyle).toBe("standard");
		expect(cat.allowAdditional).toBe(false);
	});

	it("each move stored has selection.value=1", async () => {
		const repo = new FakeMoveRepository([], [], [new FakeCompendiumMoveBuilder().withName("Haunt").build()]);
		const m = makeMoves({repo});
		await m.addCategory("insert-revenant", "Revenant", "revenant");
		expect((await m.buildSnapshot()).categories[0].moves[0].selection.value).toBe(1);
	});

	it("preserves choices from repo move so snapshot shows a ChoiceGroup", async () => {
		const repo = new FakeMoveRepository([], [], [new FakeCompendiumMoveBuilder().withName("Haunt").withChoices(CHOICES_DATA).build()]);
		const m = makeMoves({repo});
		await m.addCategory("insert-revenant", "Revenant", "revenant");
		const snap = (await m.buildSnapshot()).categories[0].moves[0];
		expect(snap.choices).toBeInstanceOf(ChoiceGroup);
		expect(snap.choices.list).toHaveLength(CHOICES_DATA.list.length);
	});
});

// ── removeCategory ────────────────────────────────────────────────────────────

describe("CharacterMoves.removeCategory", () => {
	it("removes the category", async () => {
		const repo = new FakeMoveRepository([], [], [new FakeCompendiumMoveBuilder().withName("Haunt").build()]);
		const actor = makeActor();
		const m = makeMoves({repo, actor});
		await m.addCategory("insert-revenant", "Revenant", "revenant");
		await m.removeCategory("insert-revenant");
		expect((await m.buildSnapshot()).categories.find(c => c.key === "insert-revenant")).toBeUndefined();
	});

	it("deletes embedded docs for all ownedIds", async () => {
		const repo = new FakeMoveRepository([], [], [new FakeCompendiumMoveBuilder().withName("Haunt").build()]);
		const actor = makeActor();
		const m = makeMoves({repo, actor});
		await m.addCategory("insert-revenant", "Revenant", "revenant");
		const hauntId = actor.createdDocs[0]._id;
		await m.removeCategory("insert-revenant");
		expect(actor.deletedIds).toContain(hauntId);
	});

	it("does not delete any docs when no ownedIds", async () => {
		const actor = makeActor();
		const m = makeMoves({actor});
		await m.addCategory("insert-revenant", "Revenant", "revenant");
		await m.removeCategory("insert-revenant");
		expect(actor.deletedIds).toHaveLength(0);
	});

	it("does nothing when category does not exist", async () => {
		const actor = makeActor();
		await makeMoves({actor}).removeCategory("insert-revenant");
		expect(actor.deletedIds).toHaveLength(0);
	});

	it("category is gone from subsequent buildSnapshot", async () => {
		const m = makeMoves();
		await m.addCategory("insert-revenant", "Revenant", "revenant");
		await m.removeCategory("insert-revenant");
		expect((await m.buildSnapshot()).categories.find(c => c.key === "insert-revenant")).toBeUndefined();
	});
});

// ── incrementMove ─────────────────────────────────────────────────────────────

describe("CharacterMoves.incrementMove", () => {
	it("increments selection.value", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Alpha").withRepeatMax(2).build()]);
		const m = makeMoves({repo});
		await m.initPlaybookCategory(makePlaybookData());
		await m.incrementMove("playbook-the-heavy", "alpha");
		expect((await m.buildSnapshot()).categories[0].moves[0].selection.value).toBe(1);
	});

	it("does nothing when already at max", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Alpha").asStarting().build()]);
		const actor = makeActor();
		const m = makeMoves({repo, actor});
		await m.initPlaybookCategory(makePlaybookData());
		const docsBefore = actor.createdDocs.length;
		await m.incrementMove("playbook-the-heavy", "alpha");
		expect(actor.createdDocs.length).toBe(docsBefore);
	});

	it("ownedId is already assigned from initPlaybookCategory", async () => {
		const repo  = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Alpha").withRepeatMax(2).build()]);
		const actor = makeActor();
		const m     = makeMoves({repo, actor});
		await m.initPlaybookCategory(makePlaybookData());
		const initDocId = actor.createdDocs[0]._id;
		await m.incrementMove("playbook-the-heavy", "alpha");
		expect((await m.buildSnapshot()).categories[0].moves[0].ownedId).toBe(initDocId);
		expect(actor.createdDocs).toHaveLength(1);
	});

	it("updates existing item to acquired=true with incremented instanceCount", async () => {
		const repo  = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Alpha").withRepeatMax(2).build()]);
		const actor = makeActor();
		const m     = makeMoves({repo, actor});
		await m.initPlaybookCategory(makePlaybookData());
		await m.incrementMove("playbook-the-heavy", "alpha");
		expect(actor.updatedDocs[0].system.acquired).toBe(true);
		expect(actor.updatedDocs[0].system.instanceCount).toBe(1);
	});
});

// ── decrementMove ─────────────────────────────────────────────────────────────

describe("CharacterMoves.decrementMove", () => {
	it("decrements selection.value", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Alpha").asStarting().withRepeatMax(2).build()]);
		const actor = makeActor();
		const m = makeMoves({repo, actor});
		await m.initPlaybookCategory(makePlaybookData());
		await m.incrementMove("playbook-the-heavy", "alpha");
		await m.decrementMove("playbook-the-heavy", "alpha");
		expect((await m.buildSnapshot()).categories[0].moves[0].selection.value).toBe(1);
	});

	it("updates existing item to acquired=false when count reaches 0", async () => {
		const repo  = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Alpha").withRepeatMax(2).build()]);
		const actor = makeActor();
		const m     = makeMoves({repo, actor});
		await m.initPlaybookCategory(makePlaybookData());
		await m.incrementMove("playbook-the-heavy", "alpha");
		await m.decrementMove("playbook-the-heavy", "alpha");
		const lastUpdate = actor.updatedDocs.at(-1);
		expect(lastUpdate.system.acquired).toBe(false);
		expect(lastUpdate.system.instanceCount).toBe(0);
	});

	it("does nothing when value is already 0", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Alpha").build()]);
		const actor = makeActor();
		const m = makeMoves({repo, actor});
		await m.initPlaybookCategory(makePlaybookData());
		await m.decrementMove("playbook-the-heavy", "alpha");
		expect(actor.deletedIds).toHaveLength(0);
		expect((await m.buildSnapshot()).categories[0].moves[0].selection.value).toBe(0);
	});

	it("does not decrement below 1 when isStarting", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Alpha").asStarting().build()]);
		const actor = makeActor();
		const m = makeMoves({repo, actor});
		await m.initPlaybookCategory(makePlaybookData());
		const deletedBefore = [...actor.deletedIds];
		await m.decrementMove("playbook-the-heavy", "alpha");
		expect(actor.deletedIds).toEqual(deletedBefore);
		expect((await m.buildSnapshot()).categories[0].moves[0].selection.value).toBe(1);
	});
});

// ── addMoveToOther ────────────────────────────────────────────────────────────

describe("CharacterMoves.addMoveToOther", () => {
	it("returns true and adds move to other category", async () => {
		const m = makeMoves();
		const result = await m.addMoveToOther({name: "Custom Move", system: {}});
		expect(result).toBe(true);
		const snap = await m.buildSnapshot();
		expect(snap.categories.find(c => c.key === "other").moves.find(mv => mv.slug === "custom-move")).toBeDefined();
	});

	it("creates the other category if it does not exist", async () => {
		const m = makeMoves();
		await m.addMoveToOther({name: "Custom Move", system: {}});
		expect((await m.buildSnapshot()).categories.find(c => c.key === "other")).toBeDefined();
	});

	it("other category has allowAdditional=true", async () => {
		const m = makeMoves();
		await m.addMoveToOther({name: "Custom Move", system: {}});
		expect((await m.buildSnapshot()).categories.find(c => c.key === "other").allowAdditional).toBe(true);
	});

	it("returns false when move with same name already in other", async () => {
		const actor = makeActor();
		const m = makeMoves({actor});
		await m.addMoveToOther({name: "Custom Move", system: {}});
		const docsBefore = actor.createdDocs.length;
		const result = await m.addMoveToOther({name: "Custom Move", system: {}});
		expect(result).toBe(false);
		expect(actor.createdDocs.length).toBe(docsBefore);
	});

	it("assigns an ownedId after creating embedded doc", async () => {
		const actor = makeActor();
		const m = makeMoves({actor});
		await m.addMoveToOther({name: "Custom Move", system: {rollStat: "str"}});
		expect((await m.buildSnapshot()).categories[0].moves[0].ownedId).toBe(actor.createdDocs[0]._id);
	});

	it("created item has categoryKey='other', acquired=true, instanceCount=1", async () => {
		const actor = makeActor();
		await makeMoves({actor}).addMoveToOther({name: "Custom Move", system: {}});
		expect(actor.createdDocs[0].system.categoryKey).toBe("other");
		expect(actor.createdDocs[0].system.acquired).toBe(true);
		expect(actor.createdDocs[0].system.instanceCount).toBe(1);
	});

	it("preserves choices from source move so snapshot shows a ChoiceGroup", async () => {
		const m = makeMoves();
		await m.addMoveToOther({ name: "Custom Move", system: { choices: CHOICES_DATA } });
		const snap = (await m.buildSnapshot()).categories.find(c => c.key === "other").moves[0];
		expect(snap.choices).toBeInstanceOf(ChoiceGroup);
		expect(snap.choices.list).toHaveLength(CHOICES_DATA.list.length);
	});
});

// ── deleteMove ────────────────────────────────────────────────────────────────

describe("CharacterMoves.deleteMove", () => {
	it("removes the move from the other category", async () => {
		const m = makeMoves();
		await m.addMoveToOther({name: "To Delete", system: {}});
		await m.deleteMove("to-delete");
		const snap = await m.buildSnapshot();
		expect(snap.categories.find(c => c.key === "other")?.moves.find(mv => mv.slug === "to-delete")).toBeUndefined();
	});

	it("deletes embedded docs", async () => {
		const actor = makeActor();
		const m = makeMoves({actor});
		await m.addMoveToOther({name: "To Delete", system: {}});
		const docId = actor.createdDocs[0]._id;
		await m.deleteMove("to-delete");
		expect(actor.deletedIds).toContain(docId);
	});

	it("does nothing when move not found", async () => {
		const actor = makeActor();
		await makeMoves({actor}).deleteMove("nonexistent");
		expect(actor.deletedIds).toHaveLength(0);
	});
});

// ── setMoveResourceCurrent ────────────────────────────────────────────────────

describe("CharacterMoves.setMoveResourceCurrent", () => {
	it("persists current — reflected in buildSnapshot resource.current", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Bulwark").asStarting().withResource({max: 3, title: "Favor", labels: []}).build()]);
		const m = makeMoves({repo});
		await m.initPlaybookCategory(makePlaybookData());
		await m.setMoveResourceCurrent("bulwark", 2);
		expect((await m.buildSnapshot()).categories[0].moves[0].resource.current).toBe(2);
	});
});

// ── onDropMove ────────────────────────────────────────────────────────────────

describe("CharacterMoves.onDropMove", () => {
	it("increments selection for existing playbook move", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Bulwark").withRepeatMax(2).build()]);
		const actor = makeActor();
		const m = makeMoves({repo, actor});
		await m.initPlaybookCategory(makePlaybookData());
		const result = await m.onDropMove({name: "Bulwark", system: {}});
		expect(result).toBe(true);
		expect(actor.createdDocs).toHaveLength(1);
	});

	it("returns false when playbook move is already at max selection", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Bulwark").asStarting().build()]);
		const actor = makeActor();
		const m = makeMoves({repo, actor});
		await m.initPlaybookCategory(makePlaybookData());
		const docsBefore = actor.createdDocs.length;
		const result = await m.onDropMove({name: "Bulwark", system: {}});
		expect(result).toBe(false);
		expect(actor.createdDocs.length).toBe(docsBefore);
	});

	it("adds unknown move to other category", async () => {
		const m = makeMoves();
		const result = await m.onDropMove({name: "Stranger Move", system: {}});
		expect(result).toBe(true);
		expect((await m.buildSnapshot()).categories.find(c => c.key === "other")).toBeDefined();
	});
});

// ── countOwnedBySlug ──────────────────────────────────────────────────────────

describe("CharacterMoves.countOwnedBySlug", () => {
	it("returns 0 when no categories exist", () => {
		expect(makeMoves().countOwnedBySlug("bulwark")).toBe(0);
	});

	it("returns 0 when move exists but not acquired", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Bulwark").build()]);
		const m = makeMoves({repo});
		await m.initPlaybookCategory(makePlaybookData());
		expect(m.countOwnedBySlug("bulwark")).toBe(0);
	});

	it("returns selection.value when move is acquired", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Bulwark").asStarting().withRepeatMax(2).build()]);
		const actor = makeActor();
		const m = makeMoves({repo, actor});
		await m.initPlaybookCategory(makePlaybookData());
		await m.incrementMove("playbook-the-heavy", "bulwark");
		expect(m.countOwnedBySlug("bulwark")).toBe(2);
	});

	it("returns 0 when slug does not match any move", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Alpha").build()]);
		const m = makeMoves({repo});
		await m.initPlaybookCategory(makePlaybookData());
		expect(m.countOwnedBySlug("bulwark")).toBe(0);
	});
});

// ── buildSnapshot — choices ───────────────────────────────────────────────────

describe("CharacterMoves.buildSnapshot — choices", () => {
	it("choices is null when repo has no choices for move", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Alpha").build()]);
		const m = makeMoves({repo});
		await m.initPlaybookCategory(makePlaybookData());
		expect((await m.buildSnapshot()).categories[0].moves[0].choices).toBeNull();
	});

	it("choices is a ChoiceGroup when repo move has choices", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Potential for Greatness").withChoices(CHOICES_DATA).build()]);
		const m = makeMoves({repo});
		await m.initPlaybookCategory(makePlaybookData());
		const snap = (await m.buildSnapshot()).categories[0].moves[0];
		expect(snap.choices).toBeInstanceOf(ChoiceGroup);
		expect(snap.choices.list).toHaveLength(CHOICES_DATA.list.length);
	});

	it("HeadingRow.input reflects saved text value from setMoveChoiceText", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Potential for Greatness").withChoices(CHOICES_DATA).build()]);
		const m = makeMoves({repo});
		await m.initPlaybookCategory(makePlaybookData());
		await m.setMoveChoiceText("potential-for-greatness", "stat1-input", "level 2");
		const row = (await m.buildSnapshot()).categories[0].moves[0].choices.list.find(r => r.slug === "stat1");
		expect(row.input.value).toBe("level 2");
		expect(row.input.slug).toBe("stat1-input");
		expect(row.input.placeholder).toBe("level checked");
	});

	it("HeadingRow track reflects saved count from setMoveChoiceCount", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Potential for Greatness").withChoices(CHOICES_DATA).build()]);
		const m = makeMoves({repo});
		await m.initPlaybookCategory(makePlaybookData());
		await m.setMoveChoiceCount("potential-for-greatness", "stat1", 1);
		const row = (await m.buildSnapshot()).categories[0].moves[0].choices.list.find(r => r.slug === "stat1");
		expect(row.track.checks[0]).toBe(true);
	});
});

// ── buildSnapshot — world move enrichment ─────────────────────────────────────

describe("CharacterMoves.buildSnapshot — world move enrichment", () => {
	it("shows name and description for a world move in other category", async () => {
		const m = makeMoves();
		await m.addMoveToOther({name: "Iron Wall", system: {description: "Block it.", rollStat: "str"}});
		const other = (await m.buildSnapshot()).categories.find(c => c.key === "other");
		const snap  = other.moves[0];
		expect(snap.name).toBe("Iron Wall");
		expect(snap.description).toBe("Block it.");
		expect(snap.rollStat).toBe("str");
	});
});

// ── initPlaybookCategory — world playbook moves ───────────────────────────────

describe("CharacterMoves.initPlaybookCategory — world playbook moves", () => {
	it("world move for matching playbook appears in playbook category", async () => {
		const repo = new FakeMoveRepository();
		repo.addWorld(
			new FakeCompendiumMoveBuilder()
				.withName("Smite")
				.withPlaybook("The Blessed")
				.withMoveType("playbook")
				.asStarting()
				.build()
		);
		const m = makeMoves({repo});
		await m.initPlaybookCategory({slug: "the-blessed", name: "The Blessed", startingMovesNote: null, backgrounds: []});
		const cat = (await m.buildSnapshot()).categories.find(c => c.key === "playbook-the-blessed");
		expect(cat.moves.some(mv => mv.name === "Smite")).toBe(true);
	});
});
