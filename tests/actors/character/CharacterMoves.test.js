import {describe, expect, it} from "vitest";
import {CharacterMoves} from "../../../src/actors/character/CharacterMoves.js";
import {ChoiceGroupControllerFactory} from "../../../src/actors/character/ChoiceGroupControllerFactory.js";
import {ResourceController} from "../../../src/actors/character/ResourceController.js";
import {FakeMoveRepository} from "../../fakes/FakeMoveRepository.js";
import {FakeCharacterActorBuilder} from "../../fakes/FakeCharacterActorBuilder.js";
import {FakeCompendiumMoveBuilder} from "../../fakes/FakeCompendiumMoveBuilder.js";
import {TestChoiceGroupBuilder} from "../../fakes/TestChoiceGroupBuilder.js";
import {TestChoiceRowBuilder} from "../../fakes/TestChoiceRowBuilder.js";
import {enrichRichTextTree} from "../../../src/utils/enrichRichText.js";
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

function makeActor() { return new FakeCharacterActorBuilder().build(); }

function makeMoves({
	repo   = new FakeMoveRepository(),
	actor  = makeActor(),
	vitals = {level: 1},
} = {}) {
	const res = new ResourceController(actor);
	const m   = new CharacterMoves(repo, actor, res, new ChoiceGroupControllerFactory(actor));
	m.setVitals(vitals);
	return m;
}

function makePlaybookData(overrides = {}) {
	return {slug: "the-heavy", name: "The Heavy", startingMovesNote: null, backgrounds: [], moves: [], startingMoves: [], ...overrides};
}

// Init a playbook category from the repo's fixture moves: the playbook offers every move the repo
// knows, and its startingMoves are the ones flagged `.asStarting()`. Mirrors how a real playbook
// owns its moves by slug + marks a starting subset.
async function initPlaybook(m, repo, overrides = {}) {
	const moves         = [...(await repo.buildSlugIndex()).keys()];
	const startingMoves = await repo.startingSlugs();
	return m.initPlaybookCategory(makePlaybookData({ moves, startingMoves, ...overrides }));
}

// Plain move-like objects for sortPlaybookMoves (it reads name/requires/minLevel).
function mv(name, {requires = null, minLevel = null} = {}) {
	return { name, requires, minLevel };
}
const names = ms => ms.map(m => m.name);

// ── buildSnapshot — empty ─────────────────────────────────────────────────────

describe("CharacterMoves.buildSnapshot — empty", () => {
	it("returns a Movelist when no categories in flags", async () => {
		expect(await makeMoves().buildSnapshot()).toBeInstanceOf(Movelist);
	});
	it("categories is empty when no categories stored", async () => {
		expect((await makeMoves().buildSnapshot()).categories).toHaveLength(0);
	});
});

// ── buildSnapshot — bySlug registry ──────────────────────────────────────────

describe("CharacterMoves.buildSnapshot — bySlug registry", () => {
	it("keys every owned move by its slug (the registry inline move grants resolve against)", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Bulwark").asStarting().build()]);
		const m = makeMoves({ repo });
		await initPlaybook(m, repo);
		const snap = await m.buildSnapshot();
		expect(snap.bySlug["bulwark"]).toBeDefined();
		expect(snap.bySlug["bulwark"].slug).toBe("bulwark");
		// bySlug entries are the same MoveSnapshots the tab categories render.
		expect(snap.bySlug["bulwark"]).toBe(snap.categories[0].moves[0]);
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
		await initPlaybook(m, repo, {startingMovesNote: "Pick 2."});
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
		await initPlaybook(m, repo);
		const initDocId = actor.createdDocs[0]._id;
		await m.incrementMove("playbook-the-heavy", "bulwark");
		expect((await m.buildSnapshot()).categories[0].moves[0].ownedId).toBe(initDocId);
	});

	it("move ownedId is set even when not acquired (embedded at init with acquired=false)", async () => {
		const repo  = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Optional").build()]);
		const actor = makeActor();
		const m     = makeMoves({repo, actor});
		await initPlaybook(m, repo);
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
		await initPlaybook(m, repo);
		await m.setMoveResourceCurrent("bulwark", 2);
		const snap = (await m.buildSnapshot()).categories[0].moves[0];
		expect(snap.resource.max).toBe(3);
		expect(snap.resource.current).toBe(2);
	});

	it("selection.value reflects instanceCount on embedded item after increment", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Alpha").withRepeatMax(2).build()]);
		const m    = makeMoves({repo});
		await initPlaybook(m, repo);
		await m.incrementMove("playbook-the-heavy", "alpha");
		expect((await m.buildSnapshot()).categories[0].moves[0].selection.value).toBe(1);
	});

	it("buildSnapshot derives categories from actor.items when system.moves is empty", async () => {
		const actor = new FakeCharacterActorBuilder().build();
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
		await initPlaybook(m, repo);
		const snap = (await m.buildSnapshot()).categories[0].moves[0];
		expect(snap.name).toBe("Potential for Greatness");
		expect(snap.description.raw).toBe("<p>Once per level…</p>");
	});

	it("choices from repo renders as ChoiceGroup", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Potential for Greatness").withChoices(CHOICES_DATA).build()]);
		const m = makeMoves({repo});
		await initPlaybook(m, repo);
		const snap = (await m.buildSnapshot()).categories[0].moves[0];
		expect(snap.choices).toBeInstanceOf(ChoiceGroup);
		expect(snap.choices.list).toHaveLength(CHOICES_DATA.list.length);
	});

	it("selection.value comes from flag state (acquired), not repo", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Alpha").asStarting().build()]);
		const m = makeMoves({repo});
		await initPlaybook(m, repo);
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
		await initPlaybook(m, repo);
		m._moveRepo = new FakeMoveRepository();
		const snap  = (await m.buildSnapshot()).categories[0].moves[0];
		expect(snap.name).toBe("Bulwark");
		expect(snap.description.raw).toBe("Sturdy.");
	});
});

// ── buildSnapshot — requiresLabel ─────────────────────────────────────────────

describe("CharacterMoves.buildSnapshot — requiresLabel", () => {
	async function snapMove(builder) {
		const repo = new FakeMoveRepository([builder.build()]);
		const m = makeMoves({repo});
		await initPlaybook(m, repo);
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
		await initPlaybook(m, repo);
		expect((await m.buildSnapshot()).categories[0].moves[0].selectable).toBe(false);
	});

	it("selectable=true when acquired count is below max", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Alpha").withRepeatMax(2).build()]);
		const m = makeMoves({repo});
		await initPlaybook(m, repo);
		expect((await m.buildSnapshot()).categories[0].moves[0].selectable).toBe(true);
	});

	it("requirement.met=false when level requirement exceeds actor level", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Alpha").withRequirement({moves: [], level: 6, playbook: null}).build()]);
		const m = makeMoves({repo, vitals: {level: 1}});
		await initPlaybook(m, repo);
		const move = (await m.buildSnapshot()).categories[0].moves[0];
		expect(move.selectable).toBe(true);
		expect(move.requirement.met).toBe(false);
	});

	it("requirement.met=true when level requirement equals actor level", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Alpha").withRequirement({moves: [], level: 3, playbook: null}).build()]);
		const m = makeMoves({repo, vitals: {level: 3}});
		await initPlaybook(m, repo);
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
		await initPlaybook(m, repo);
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
		await initPlaybook(m, repo);
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
		const repo = new FakeMoveRepository().addInsertMove(new FakeCompendiumMoveBuilder().withName("Haunt").build());
		const m = makeMoves({repo});
		await m.addCategory("insert-revenant", "Revenant", ["haunt"]);
		const snaps = await m.getMoveSnapshotsForCategory("insert-revenant");
		expect(snaps).toHaveLength(1);
		expect(snaps[0]).toBeInstanceOf(MoveSnapshot);
		expect(snaps[0].name).toBe("Haunt");
	});

	it("returned snapshot has correct source.type", async () => {
		const repo = new FakeMoveRepository().addInsertMove(new FakeCompendiumMoveBuilder().withName("Haunt").build());
		const m = makeMoves({repo});
		await m.addCategory("insert-revenant", "Revenant", ["haunt"]);
		expect((await m.getMoveSnapshotsForCategory("insert-revenant"))[0].source.type).toBe("insert-revenant");
	});

	it("reads move data from embedded item, not live repo", async () => {
		const repo = new FakeMoveRepository().addInsertMove(new FakeCompendiumMoveBuilder().withName("Haunt").build());
		const m    = makeMoves({repo});
		await m.addCategory("insert-revenant", "Revenant", ["haunt"]);
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

	// Reference seeding is pack-only: a same-type move sitting in the world's Items directory (e.g.
	// dragged out of the compendium) is NOT part of the reference set and must not be auto-seeded.
	// Custom/homebrew moves reach a character through drag-drop, not this seed.
	it("ignores world-item moves — only the compendium reference set is seeded", async () => {
		const repo  = new FakeMoveRepository([], [new FakeCompendiumMoveBuilder().withName("Defy Danger").asStarting().build()]);
		const actor = makeActor();
		const m     = makeMoves({repo, actor});
		await m.initBasicMoves();
		const docsAfterFirst = actor.createdDocs.length;

		repo.addWorld(new FakeCompendiumMoveBuilder().withName("Aid or Interfere").withMoveType("basic").asStarting().build());
		await m.initBasicMoves();

		const cat = (await m.buildSnapshot()).categories.find(c => c.key === "basic");
		expect(cat.moves.some(mv => mv.name === "Aid or Interfere")).toBe(false);
		expect(cat.moves.some(mv => mv.name === "Defy Danger")).toBe(true);
		expect(actor.createdDocs.length).toBe(docsAfterFirst);
	});

	it("also seeds expedition, special and follower moves as side-bar categories under basic", async () => {
		const repo = new FakeMoveRepository([], [
			new FakeCompendiumMoveBuilder().withName("Defy Danger").withMoveType("basic").asStarting().build(),
			new FakeCompendiumMoveBuilder().withName("Make Camp").withMoveType("expedition").asStarting().build(),
			new FakeCompendiumMoveBuilder().withName("Death's Door").withMoveType("special").asStarting().build(),
			new FakeCompendiumMoveBuilder().withName("Order Followers").withMoveType("follower").asStarting().build(),
		]);
		const actor = makeActor();
		const m = makeMoves({repo, actor});
		await m.initBasicMoves();

		const cats = (await m.buildSnapshot()).categories;
		const byKey = Object.fromEntries(cats.map(c => [c.key, c]));
		// All four are side-bar, ordered basic → expedition → special → follower.
		expect(cats.map(c => c.key)).toEqual(["basic", "expedition", "special", "follower"]);
		expect(byKey.expedition.renderStyle).toBe("side-bar");
		expect(byKey.special.renderStyle).toBe("side-bar");
		expect(byKey.follower.renderStyle).toBe("side-bar");
		expect(byKey.expedition.moves[0].name).toBe("Make Camp");
		expect(byKey.special.moves[0].name).toBe("Death's Door");
		expect(byKey.follower.moves[0].name).toBe("Order Followers");
		expect(actor.createdDocs.find(d => d.name === "Death's Door").system.categoryKey).toBe("special");
	});

	it("seeds the expedition category acquired, labelled, and not open to additional moves", async () => {
		const repo = new FakeMoveRepository([], [
			new FakeCompendiumMoveBuilder().withName("Chart a Course").withMoveType("expedition").asStarting().build(),
		]);
		const actor = makeActor();
		const m = makeMoves({repo, actor});
		await m.initBasicMoves();

		const cat = (await m.buildSnapshot()).categories.find(c => c.key === "expedition");
		expect(cat.label).toBe("Expedition Moves");
		expect(cat.allowAdditional).toBe(false);
		expect(cat.note).toBe(null);
		expect(cat.moves[0].selection.value).toBe(1);
		expect(actor.createdDocs[0].system.categoryKey).toBe("expedition");
		expect(actor.createdDocs[0].system.acquired).toBe(true);
	});

	it("is idempotent across all reference categories", async () => {
		const repo = new FakeMoveRepository([], [
			new FakeCompendiumMoveBuilder().withName("Defy Danger").withMoveType("basic").asStarting().build(),
			new FakeCompendiumMoveBuilder().withName("Death's Door").withMoveType("special").asStarting().build(),
		]);
		const actor = makeActor();
		const m = makeMoves({repo, actor});
		await m.initBasicMoves();
		const firstLen = actor.createdDocs.length;
		await m.initBasicMoves();
		expect(actor.createdDocs.length).toBe(firstLen);
	});
});

// ── initPlaybookCategory ──────────────────────────────────────────────────────

describe("CharacterMoves.initPlaybookCategory", () => {
	it("creates a playbook-<slug> category", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Bulwark").asStarting().build()]);
		const m = makeMoves({repo});
		await initPlaybook(m, repo);
		expect((await m.buildSnapshot()).categories.some(c => c.key === "playbook-the-heavy")).toBe(true);
	});

	it("starting move gets an ownedId assigned", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Bulwark").asStarting().build()]);
		const actor = makeActor();
		const m = makeMoves({repo, actor});
		await initPlaybook(m, repo);
		expect((await m.buildSnapshot()).categories[0].moves[0].ownedId).toBe(actor.createdDocs[0]._id);
	});

	it("starting move item has correct categoryKey, acquired, instanceCount", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Bulwark").asStarting().build()]);
		const actor = makeActor();
		await initPlaybook(makeMoves({repo, actor}), repo);
		expect(actor.createdDocs[0].system.categoryKey).toBe("playbook-the-heavy");
		expect(actor.createdDocs[0].system.acquired).toBe(true);
		expect(actor.createdDocs[0].system.instanceCount).toBe(1);
	});

	it("non-starting move gets an ownedId assigned", async () => {
		const repo  = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Optional").build()]);
		const actor = makeActor();
		const m     = makeMoves({repo, actor});
		await initPlaybook(m, repo);
		expect(actor.createdDocs).toHaveLength(1);
		expect((await m.buildSnapshot()).categories[0].moves[0].ownedId).toBe(actor.createdDocs[0]._id);
	});

	it("non-starting move item has acquired=false and instanceCount=0", async () => {
		const repo  = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Optional").build()]);
		const actor = makeActor();
		await initPlaybook(makeMoves({repo, actor}), repo);
		expect(actor.createdDocs[0].system.acquired).toBe(false);
		expect(actor.createdDocs[0].system.instanceCount).toBe(0);
	});

	it("embedded move item has full move data (moveResults)", async () => {
		const moveResults = { success: { label: "10+", value: "Yes!" }, partial: { label: "7-9", value: "Mostly." }, failure: { label: "6-", value: "No." } };
		const repo  = new FakeMoveRepository([
			new FakeCompendiumMoveBuilder().withName("Bulwark").asStarting().withMoveResults(moveResults).build(),
		]);
		const actor = makeActor();
		await initPlaybook(makeMoves({repo, actor}), repo);
		expect(actor.createdDocs[0].system.moveResults).toEqual(moveResults);
	});

	it("starting move has selection.value=1", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Bulwark").asStarting().build()]);
		const m = makeMoves({repo});
		await initPlaybook(m, repo);
		expect((await m.buildSnapshot()).categories[0].moves[0].selection.value).toBe(1);
	});

	it("non-starting move has selection.value=0", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Optional").build()]);
		const m = makeMoves({repo});
		await initPlaybook(m, repo);
		expect((await m.buildSnapshot()).categories[0].moves[0].selection.value).toBe(0);
	});

	it("removes existing playbook-* category and deletes its owned docs", async () => {
		const repoFox = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Fox Move").asStarting().build()]);
		const actor = makeActor();
		const m = makeMoves({repo: repoFox, actor});
		await initPlaybook(m, repoFox, {slug: "the-fox", name: "The Fox"});
		const foxDocId = actor.createdDocs[0]._id;
		const empty = new FakeMoveRepository();
		m._moveRepo = empty;
		await initPlaybook(m, empty);
		expect(actor.deletedIds).toContain(foxDocId);
		expect((await m.buildSnapshot()).categories.find(c => c.key === "playbook-the-fox")).toBeUndefined();
	});
});

// ── addCategory ───────────────────────────────────────────────────────────────

describe("CharacterMoves.addCategory", () => {
	const haunt = () => new FakeCompendiumMoveBuilder().withName("Haunt");

	it("appends the category", async () => {
		const repo = new FakeMoveRepository().addInsertMove(haunt().build());
		const m = makeMoves({repo});
		await m.addCategory("insert-revenant", "Revenant", ["haunt"]);
		expect((await m.buildSnapshot()).categories.some(c => c.key === "insert-revenant" && c.label === "Revenant")).toBe(true);
	});

	it("resolves referenced moves by slug, preserving order", async () => {
		const repo = new FakeMoveRepository()
			.addInsertMove(haunt().build())
			.addBasic(new FakeCompendiumMoveBuilder().withName("Spirit Sight").build()); // resolvable by slug
		const actor = makeActor();
		await makeMoves({repo, actor}).addCategory("insert-revenant", "Revenant", ["spirit-sight", "haunt"]);
		expect(actor.createdDocs.map(d => d.name)).toEqual(["Spirit Sight", "Haunt"]);
	});

	it("does nothing when category already exists", async () => {
		const repo = new FakeMoveRepository().addInsertMove(haunt().build());
		const actor = makeActor();
		const m = makeMoves({repo, actor});
		await m.addCategory("insert-revenant", "Revenant", ["haunt"]);
		const countBefore = actor.createdDocs.length;
		await m.addCategory("insert-revenant", "Revenant", ["haunt"]);
		expect(actor.createdDocs.length).toBe(countBefore);
	});

	it("creates embedded docs and assigns ownedId", async () => {
		const repo = new FakeMoveRepository().addInsertMove(haunt().build());
		const actor = makeActor();
		const m = makeMoves({repo, actor});
		await m.addCategory("insert-revenant", "Revenant", ["haunt"]);
		expect((await m.buildSnapshot()).categories[0].moves[0].ownedId).toBe(actor.createdDocs[0]._id);
	});

	it("a startingSlugs move seeds categoryKey + acquired=true + instanceCount=1", async () => {
		const repo = new FakeMoveRepository().addInsertMove(haunt().build());
		const actor = makeActor();
		await makeMoves({repo, actor}).addCategory("insert-revenant", "Revenant", ["haunt"], ["haunt"]);
		expect(actor.createdDocs[0].system.categoryKey).toBe("insert-revenant");
		expect(actor.createdDocs[0].system.acquired).toBe(true);
		expect(actor.createdDocs[0].system.instanceCount).toBe(1);
	});

	it("non-starting move seeds acquired=false + instanceCount=0 (player ticks to unlock)", async () => {
		const repo = new FakeMoveRepository().addInsertMove(haunt().build());
		const actor = makeActor();
		await makeMoves({repo, actor}).addCategory("arcana-norubas-ice-sphere", "Noruba's Ice Sphere", ["haunt"]);
		expect(actor.createdDocs[0].system.acquired).toBe(false);
		expect(actor.createdDocs[0].system.instanceCount).toBe(0);
	});

	it("does not create embedded docs when no slugs resolve", async () => {
		const actor = makeActor();
		await makeMoves({actor}).addCategory("insert-revenant", "Revenant", ["nope"]);
		expect(actor.createdDocs).toHaveLength(0);
	});

	it("stored category has renderStyle=standard and allowAdditional=false", async () => {
		const repo = new FakeMoveRepository().addInsertMove(haunt().build());
		const m = makeMoves({repo});
		await m.addCategory("insert-revenant", "Revenant", ["haunt"]);
		const cat = (await m.buildSnapshot()).categories.find(c => c.key === "insert-revenant");
		expect(cat.renderStyle).toBe("standard");
		expect(cat.allowAdditional).toBe(false);
	});

	it("a startingSlugs move stored has selection.value=1", async () => {
		const repo = new FakeMoveRepository().addInsertMove(haunt().build());
		const m = makeMoves({repo});
		await m.addCategory("insert-revenant", "Revenant", ["haunt"], ["haunt"]);
		expect((await m.buildSnapshot()).categories[0].moves[0].selection.value).toBe(1);
	});

	it("preserves choices from repo move so snapshot shows a ChoiceGroup", async () => {
		const repo = new FakeMoveRepository().addInsertMove(haunt().withChoices(CHOICES_DATA).build());
		const m = makeMoves({repo});
		await m.addCategory("insert-revenant", "Revenant", ["haunt"]);
		const snap = (await m.buildSnapshot()).categories[0].moves[0];
		expect(snap.choices).toBeInstanceOf(ChoiceGroup);
		expect(snap.choices.list).toHaveLength(CHOICES_DATA.list.length);
	});
});

// ── removeCategory ────────────────────────────────────────────────────────────

describe("CharacterMoves.removeCategory", () => {
	it("removes the category", async () => {
		const repo = new FakeMoveRepository().addInsertMove(new FakeCompendiumMoveBuilder().withName("Haunt").build());
		const actor = makeActor();
		const m = makeMoves({repo, actor});
		await m.addCategory("insert-revenant", "Revenant", ["haunt"]);
		await m.removeCategory("insert-revenant");
		expect((await m.buildSnapshot()).categories.find(c => c.key === "insert-revenant")).toBeUndefined();
	});

	it("deletes embedded docs for all ownedIds", async () => {
		const repo = new FakeMoveRepository().addInsertMove(new FakeCompendiumMoveBuilder().withName("Haunt").build());
		const actor = makeActor();
		const m = makeMoves({repo, actor});
		await m.addCategory("insert-revenant", "Revenant", ["haunt"]);
		const hauntId = actor.createdDocs[0]._id;
		await m.removeCategory("insert-revenant");
		expect(actor.deletedIds).toContain(hauntId);
	});

	it("does not delete any docs when no ownedIds", async () => {
		const actor = makeActor();
		const m = makeMoves({actor});
		await m.addCategory("insert-revenant", "Revenant", []);
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
		await m.addCategory("insert-revenant", "Revenant", []);
		await m.removeCategory("insert-revenant");
		expect((await m.buildSnapshot()).categories.find(c => c.key === "insert-revenant")).toBeUndefined();
	});
});

// ── incrementMove ─────────────────────────────────────────────────────────────

describe("CharacterMoves.incrementMove", () => {
	it("increments selection.value", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Alpha").withRepeatMax(2).build()]);
		const m = makeMoves({repo});
		await initPlaybook(m, repo);
		await m.incrementMove("playbook-the-heavy", "alpha");
		expect((await m.buildSnapshot()).categories[0].moves[0].selection.value).toBe(1);
	});

	it("does nothing when already at max", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Alpha").asStarting().build()]);
		const actor = makeActor();
		const m = makeMoves({repo, actor});
		await initPlaybook(m, repo);
		const docsBefore = actor.createdDocs.length;
		await m.incrementMove("playbook-the-heavy", "alpha");
		expect(actor.createdDocs.length).toBe(docsBefore);
	});

	it("ownedId is already assigned from initPlaybookCategory", async () => {
		const repo  = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Alpha").withRepeatMax(2).build()]);
		const actor = makeActor();
		const m     = makeMoves({repo, actor});
		await initPlaybook(m, repo);
		const initDocId = actor.createdDocs[0]._id;
		await m.incrementMove("playbook-the-heavy", "alpha");
		expect((await m.buildSnapshot()).categories[0].moves[0].ownedId).toBe(initDocId);
		expect(actor.createdDocs).toHaveLength(1);
	});

	it("updates existing item to acquired=true with incremented instanceCount", async () => {
		const repo  = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Alpha").withRepeatMax(2).build()]);
		const actor = makeActor();
		const m     = makeMoves({repo, actor});
		await initPlaybook(m, repo);
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
		await initPlaybook(m, repo);
		await m.incrementMove("playbook-the-heavy", "alpha");
		await m.decrementMove("playbook-the-heavy", "alpha");
		expect((await m.buildSnapshot()).categories[0].moves[0].selection.value).toBe(1);
	});

	it("updates existing item to acquired=false when count reaches 0", async () => {
		const repo  = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Alpha").withRepeatMax(2).build()]);
		const actor = makeActor();
		const m     = makeMoves({repo, actor});
		await initPlaybook(m, repo);
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
		await initPlaybook(m, repo);
		await m.decrementMove("playbook-the-heavy", "alpha");
		expect(actor.deletedIds).toHaveLength(0);
		expect((await m.buildSnapshot()).categories[0].moves[0].selection.value).toBe(0);
	});

	it("a starting move CAN be unchecked (no starting lock — guide, don't enforce)", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Alpha").asStarting().build()]);
		const actor = makeActor();
		const m = makeMoves({repo, actor});
		await initPlaybook(m, repo);
		await m.decrementMove("playbook-the-heavy", "alpha");
		const lastUpdate = actor.updatedDocs.at(-1);
		expect(lastUpdate.system.acquired).toBe(false);
		expect((await m.buildSnapshot()).categories[0].moves[0].selection.value).toBe(0);
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
		await initPlaybook(m, repo);
		await m.setMoveResourceCurrent("bulwark", 2);
		expect((await m.buildSnapshot()).categories[0].moves[0].resource.current).toBe(2);
	});
});

// ── resourceValue ─────────────────────────────────────────────────────────────

// What a move rolled against its own track reads (Dark Succor's +Favor), so "the character has no
// such track" has to stay distinguishable from "the track is at 0".
describe("CharacterMoves.resourceValue", () => {
	const withTrack = () => new FakeMoveRepository([
		new FakeCompendiumMoveBuilder().withName("Favor").asStarting()
			.withResource({max: 3, title: "Favor", labels: []}).build(),
	]);

	it("is the track's current value", async () => {
		const repo = withTrack();
		const m = makeMoves({repo});
		await initPlaybook(m, repo);
		await m.setMoveResourceCurrent("favor", 2);
		expect(m.resourceValue("favor")).toBe(2);
	});

	it("is 0 for an owned track never ticked", async () => {
		const repo = withTrack();
		const m = makeMoves({repo});
		await initPlaybook(m, repo);
		expect(m.resourceValue("favor")).toBe(0);
	});

	it("is null for an owned move that has no track", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Urges").asStarting().build()]);
		const m = makeMoves({repo});
		await initPlaybook(m, repo);
		expect(m.resourceValue("urges")).toBeNull();
	});

	it("is null for a move the character doesn't own", async () => {
		expect(makeMoves().resourceValue("favor")).toBeNull();
	});
});

// ── onDropMove ────────────────────────────────────────────────────────────────

describe("CharacterMoves.onDropMove", () => {
	it("increments selection for existing playbook move", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Bulwark").withRepeatMax(2).build()]);
		const actor = makeActor();
		const m = makeMoves({repo, actor});
		await initPlaybook(m, repo);
		const result = await m.onDropMove({name: "Bulwark", system: {}});
		expect(result).toBe(true);
		expect(actor.createdDocs).toHaveLength(1);
	});

	it("returns false when playbook move is already at max selection", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Bulwark").asStarting().build()]);
		const actor = makeActor();
		const m = makeMoves({repo, actor});
		await initPlaybook(m, repo);
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
		await initPlaybook(m, repo);
		expect(m.countOwnedBySlug("bulwark")).toBe(0);
	});

	it("returns selection.value when move is acquired", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Bulwark").asStarting().withRepeatMax(2).build()]);
		const actor = makeActor();
		const m = makeMoves({repo, actor});
		await initPlaybook(m, repo);
		await m.incrementMove("playbook-the-heavy", "bulwark");
		expect(m.countOwnedBySlug("bulwark")).toBe(2);
	});

	it("returns 0 when slug does not match any move", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Alpha").build()]);
		const m = makeMoves({repo});
		await initPlaybook(m, repo);
		expect(m.countOwnedBySlug("bulwark")).toBe(0);
	});
});

// ── buildSnapshot — choices ───────────────────────────────────────────────────

describe("CharacterMoves.buildSnapshot — choices", () => {
	it("choices is null when repo has no choices for move", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Alpha").build()]);
		const m = makeMoves({repo});
		await initPlaybook(m, repo);
		expect((await m.buildSnapshot()).categories[0].moves[0].choices).toBeNull();
	});

	it("choices is a ChoiceGroup when repo move has choices", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Potential for Greatness").withChoices(CHOICES_DATA).build()]);
		const m = makeMoves({repo});
		await initPlaybook(m, repo);
		const snap = (await m.buildSnapshot()).categories[0].moves[0];
		expect(snap.choices).toBeInstanceOf(ChoiceGroup);
		expect(snap.choices.list).toHaveLength(CHOICES_DATA.list.length);
	});

	it("HeadingRow.input reflects saved text value from setMoveChoiceText", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Potential for Greatness").withChoices(CHOICES_DATA).build()]);
		const m = makeMoves({repo});
		await initPlaybook(m, repo);
		await m.controllerFor("potential-for-greatness")?.setText("potential", "stat1-input", "level 2");
		const row = (await m.buildSnapshot()).categories[0].moves[0].choices.list.find(r => r.slug === "stat1");
		expect(row.input.value).toBe("level 2");
		expect(row.input.slug).toBe("stat1-input");
		expect(row.input.placeholder).toBe("level checked");
	});

	it("HeadingRow track reflects saved count from setMoveChoiceCount", async () => {
		const repo = new FakeMoveRepository([new FakeCompendiumMoveBuilder().withName("Potential for Greatness").withChoices(CHOICES_DATA).build()]);
		const m = makeMoves({repo});
		await initPlaybook(m, repo);
		await m.controllerFor("potential-for-greatness")?.setCount("potential", "stat1", 1);
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
		expect(snap.description.raw).toBe("Block it.");
		expect(snap.rollStat).toBe("str");
	});
});

// ── initPlaybookCategory — world playbook moves ───────────────────────────────

describe("CharacterMoves.initPlaybookCategory — world playbook moves", () => {
	it("a world move listed by slug appears in the playbook category (resolved across pack + world)", async () => {
		const repo = new FakeMoveRepository();
		repo.addWorld(new FakeCompendiumMoveBuilder().withName("Smite").asStarting().build());
		const m = makeMoves({repo});
		await initPlaybook(m, repo, {slug: "the-blessed", name: "The Blessed"});
		const cat = (await m.buildSnapshot()).categories.find(c => c.key === "playbook-the-blessed");
		expect(cat.moves.some(mv => mv.name === "Smite")).toBe(true);
	});
});

// ── sortPlaybookMoves (level grouping + dependency chaining) ───────────────────

describe("CharacterMoves.sortPlaybookMoves", () => {
	const sort = ms => makeMoves().sortPlaybookMoves(ms);

	it("returns empty array for empty input", () => {
		expect(sort([])).toEqual([]);
	});

	it("single move with no requires is returned as-is", () => {
		expect(names(sort([mv("Alpha")]))).toEqual(["Alpha"]);
	});

	it("multiple independent moves are sorted alphabetically", () => {
		expect(names(sort([mv("Charlie"), mv("Alpha"), mv("Bravo")]))).toEqual(["Alpha", "Bravo", "Charlie"]);
	});

	it("a move that requires another follows it immediately", () => {
		expect(names(sort([mv("Child", {requires: "Parent"}), mv("Parent"), mv("Alpha")]))).toEqual(["Alpha", "Parent", "Child"]);
	});

	it("multiple moves requiring same parent sorted alphabetically after it", () => {
		expect(names(sort([mv("Zeta", {requires: "Parent"}), mv("Alpha", {requires: "Parent"}), mv("Parent"), mv("Root")]))).toEqual(["Parent", "Alpha", "Zeta", "Root"]);
	});

	it("chains: grandchild follows child follows parent", () => {
		expect(names(sort([mv("Grandchild", {requires: "Child"}), mv("Child", {requires: "Parent"}), mv("Parent")]))).toEqual(["Parent", "Child", "Grandchild"]);
	});

	it("root moves stay alphabetical while dependents follow their parents", () => {
		expect(names(sort([mv("Zeal"), mv("Zeal-Child", {requires: "Zeal"}), mv("Armor"), mv("Armor-Child-B", {requires: "Armor"}), mv("Armor-Child-A", {requires: "Armor"})]))).toEqual(["Armor", "Armor-Child-A", "Armor-Child-B", "Zeal", "Zeal-Child"]);
	});

	it("move requiring non-existent parent treated as root", () => {
		expect(names(sort([mv("Orphan", {requires: "Missing Parent"}), mv("Alpha")]))).toEqual(["Alpha", "Orphan"]);
	});

	it("circular dependency does not infinite-loop", () => {
		const ms = [mv("A", {requires: "B"}), mv("B", {requires: "A"})];
		expect(() => sort(ms)).not.toThrow();
		expect(sort(ms)).toHaveLength(2);
	});

	it("level-6 moves come after all level-0 moves", () => {
		expect(names(sort([mv("Bravo", {minLevel: 6}), mv("Alpha"), mv("Charlie", {minLevel: 6})]))).toEqual(["Alpha", "Bravo", "Charlie"]);
	});

	it("level groups sorted ascending: 0, 2, 6", () => {
		expect(names(sort([mv("L6", {minLevel: 6}), mv("L2", {minLevel: 2}), mv("L0")]))).toEqual(["L0", "L2", "L6"]);
	});

	it("within a level group, dependency chaining still applies", () => {
		expect(names(sort([mv("Child", {minLevel: 6, requires: "Parent"}), mv("Parent", {minLevel: 6}), mv("Alpha", {minLevel: 6})]))).toEqual(["Alpha", "Parent", "Child"]);
	});

	it("cross-level dependency ignored: level-6 move stays in level-6 group", () => {
		expect(names(sort([mv("Root"), mv("Lv6-Child", {minLevel: 6, requires: "Root"}), mv("Alpha")]))).toEqual(["Alpha", "Root", "Lv6-Child"]);
	});
});

// Integration: a move description is a RichText, and the single enrich pass (as run in the sheet's
// getData) turns an @UUID link into a real anchor end-to-end. Only the Foundry enrichHTML boundary
// is mocked — real CharacterMoves + RichText + enrichRichTextTree.
describe("CharacterMoves — rich-text enrichment (integration)", () => {
	it("renders a move description's @UUID as a link through the one pass", async () => {
		const m = makeMoves();
		await m.addMoveToOther({name: "Linked", system: {description: "see @UUID[JournalEntry.x]{the Barrow}", rollStat: null}});
		const snap = await m.buildSnapshot();
		const move = snap.categories.find(c => c.key === "other").moves[0];
		expect(move.description.raw).toContain("@UUID");   // stored as RichText, not enriched yet

		const orig = foundry.applications.ux.TextEditor.implementation.enrichHTML;
		foundry.applications.ux.TextEditor.implementation.enrichHTML =
			async html => html.replace(/@UUID\[[^\]]+\]\{([^}]+)\}/g, '<a class="content-link">$1</a>');
		try {
			await enrichRichTextTree(snap, {});
		} finally {
			foundry.applications.ux.TextEditor.implementation.enrichHTML = orig;
		}

		expect(move.description.render()).toContain('<a class="content-link">the Barrow</a>');
	});
});

// ── sendToChat ────────────────────────────────────────────────────────────────

describe("CharacterMoves.sendToChat", () => {
	it("finds the owned move by stored slug and hands it to the actor's chat surface", async () => {
		const actor = new FakeCharacterActorBuilder()
			.addItem({_id: "m1", type: "move", name: "Aid Someone", system: {slug: "aid-someone", categoryKey: "basic"}})
			.build();
		const moves = makeMoves({actor});
		expect(await moves.sendToChat("aid-someone")).toBe(true);
		expect(actor.chatItems).toHaveLength(1);
		expect(actor.chatItems[0]._id).toBe("m1");
	});

	it("falls back to toSlug(name) for a legacy move without a stored slug", async () => {
		const actor = new FakeCharacterActorBuilder()
			.addItem({_id: "m2", type: "move", name: "Old Move", system: {categoryKey: "other"}})
			.build();
		const moves = makeMoves({actor});
		expect(await moves.sendToChat("old-move")).toBe(true);
		expect(actor.chatItems[0]._id).toBe("m2");
	});

	it("returns false (and posts nothing) when no owned move carries the slug", async () => {
		const actor = makeActor();
		const moves = makeMoves({actor});
		expect(await moves.sendToChat("not-a-move")).toBe(false);
		expect(actor.chatItems).toHaveLength(0);
	});
});
