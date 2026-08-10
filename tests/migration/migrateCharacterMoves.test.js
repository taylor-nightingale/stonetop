import { describe, expect, it } from "vitest";
import { migrateAddedReferenceMoves, migrateCharacterMoves, migrateReferenceMoveCategories } from "../../src/migration/migrateCharacter.js";
import { FakeCharacterActorBuilder } from "../fakes/FakeCharacterActorBuilder.js";
import { FakeMoveRepository } from "../fakes/FakeMoveRepository.js";
import { FakeCompendiumMoveBuilder } from "../fakes/FakeCompendiumMoveBuilder.js";

function makeActor(flags = {}, items = []) {
	const builder = new FakeCharacterActorBuilder().withItems(items);
	builder.withFlags(flags);
	return builder.build();
}

function makeOldMoveItem(id, name) {
	// Old 0.9.1 embedded move item: has no categoryKey
	return { _id: id, type: "move", name, system: { slug: name.toLowerCase().replace(/ /g, "-"), categoryKey: null } };
}

function makeFlagCategory(key, moves, label = null, note = null) {
	return { key, label, note, moves };
}

function makeFlagMove(slug, ownedIds, selectionValue = 1, compendiumId = null) {
	return { slug, compendiumId, isStarting: false, selection: { max: 1, value: selectionValue }, ownedIds };
}

// ── gate ─────────────────────────────────────────────────────────────────────

describe("migrateCharacterMoves — gate", () => {
	it("skips if any move already has categoryKey", async () => {
		const actor = makeActor({}, [
			{ _id: "m1", type: "move", name: "Hack", system: { slug: "hack", categoryKey: "basic" } },
		]);
		await migrateCharacterMoves(actor, new FakeMoveRepository());
		expect(actor.deletedIds).toHaveLength(0);
		expect(actor.updatedDocs).toHaveLength(0);
	});
});

// ── other-category moves ──────────────────────────────────────────────────────

describe("migrateCharacterMoves — other category moves updated in place", () => {
	it("sets categoryKey=other on an other-category move via updateEmbeddedDocuments", async () => {
		const actor = makeActor(
			{ "moves.categories": [makeFlagCategory("other", [makeFlagMove("cat-nap", ["m-other"])])] },
			[makeOldMoveItem("m-other", "Cat Nap")],
		);
		await migrateCharacterMoves(actor, new FakeMoveRepository());
		const update = actor.updatedDocs.find(u => u._id === "m-other");
		expect(update?.system.categoryKey).toBe("other");
		expect(update?.system.acquired).toBe(true);
	});

	it("sets instanceCount from selection.value", async () => {
		const actor = makeActor(
			{ "moves.categories": [makeFlagCategory("other", [makeFlagMove("rep", ["m1", "m2", "m3"], 3)])] },
			[makeOldMoveItem("m1", "Rep"), makeOldMoveItem("m2", "Rep"), makeOldMoveItem("m3", "Rep")],
		);
		await migrateCharacterMoves(actor, new FakeMoveRepository());
		const update = actor.updatedDocs.find(u => u._id === "m1");
		expect(update?.system.instanceCount).toBe(3);
	});

	it("deletes duplicate instances (ownedIds[1..]) for repeatable moves", async () => {
		const actor = makeActor(
			{ "moves.categories": [makeFlagCategory("other", [makeFlagMove("rep", ["m1", "m2", "m3"], 3)])] },
			[makeOldMoveItem("m1", "Rep"), makeOldMoveItem("m2", "Rep"), makeOldMoveItem("m3", "Rep")],
		);
		await migrateCharacterMoves(actor, new FakeMoveRepository());
		expect(actor.deletedIds).toContain("m2");
		expect(actor.deletedIds).toContain("m3");
		expect(actor.deletedIds).not.toContain("m1");
	});

	it("does not delete other-category move items", async () => {
		const actor = makeActor(
			{ "moves.categories": [makeFlagCategory("other", [makeFlagMove("cat-nap", ["m-other"])])] },
			[makeOldMoveItem("m-other", "Cat Nap")],
		);
		await migrateCharacterMoves(actor, new FakeMoveRepository());
		expect(actor.deletedIds).not.toContain("m-other");
	});
});

// ── old basic/playbook items deleted ─────────────────────────────────────────

describe("migrateCharacterMoves — old basic/playbook items deleted", () => {
	it("deletes old basic move items", async () => {
		const basicDoc = new FakeCompendiumMoveBuilder().withName("Hack and Slash").asStarting().build();
		const repo = new FakeMoveRepository([], [basicDoc]);
		const actor = makeActor(
			{ "moves.categories": [makeFlagCategory("basic", [makeFlagMove("hack-and-slash", ["m-basic"], 1, basicDoc._id)])] },
			[makeOldMoveItem("m-basic", "Hack and Slash")],
		);
		await migrateCharacterMoves(actor, repo);
		expect(actor.deletedIds).toContain("m-basic");
	});

	it("deletes old playbook move items", async () => {
		const playbookDoc = new FakeCompendiumMoveBuilder().withName("The Spirits Speak").asStarting().build();
		const repo = new FakeMoveRepository([playbookDoc]);
		const playbookItem = { _id: "pb1", type: "playbook", name: "The Blessed", system: { slug: "blessed", startingMovesNote: null } };
		const actor = makeActor(
			{ "moves.categories": [makeFlagCategory("playbook-blessed", [makeFlagMove("the-spirits-speak", ["m-pb"], 1, playbookDoc._id)])] },
			[makeOldMoveItem("m-pb", "The Spirits Speak"), playbookItem],
		);
		await migrateCharacterMoves(actor, repo);
		expect(actor.deletedIds).toContain("m-pb");
	});
});

// ── basic moves re-created ────────────────────────────────────────────────────

describe("migrateCharacterMoves — basic moves re-created", () => {
	it("creates basic move items with categoryKey=basic", async () => {
		const basicDoc = new FakeCompendiumMoveBuilder().withName("Hack and Slash").asStarting().build();
		const repo = new FakeMoveRepository([], [basicDoc]);
		const actor = makeActor({}, []);
		await migrateCharacterMoves(actor, repo);
		const created = actor.createdDocs.find(d => d.name === "Hack and Slash");
		expect(created?.system.categoryKey).toBe("basic");
		expect(created?.system.acquired).toBe(true);
	});
});

// ── playbook moves re-created with correct name ───────────────────────────────

describe("migrateCharacterMoves — playbook category uses item.name as label", () => {
	it("creates playbook moves with categoryLabel set to the playbook document name", async () => {
		const foxMove = new FakeCompendiumMoveBuilder()
			.withName("The Spirits Speak")
			.build();
		const repo = new FakeMoveRepository([foxMove]);
		const playbookItem = {
			_id: "pb1", type: "playbook", name: "The Fox",
			system: { slug: "the-fox", startingMovesNote: null, moves: ["the-spirits-speak"], startingMoves: ["the-spirits-speak"] },
		};
		const actor = makeActor({}, [playbookItem]);
		await migrateCharacterMoves(actor, repo);
		const created = actor.createdDocs.find(d => d.name === "The Spirits Speak");
		expect(created?.system.categoryLabel).toBe("The Fox");
	});
});

// ── non-starting acquired moves marked acquired ───────────────────────────────

describe("migrateCharacterMoves — non-starting acquired moves are marked acquired", () => {
	it("sets acquired=true and instanceCount on non-starting moves with selection.value > 0", async () => {
		const acquiredMove = new FakeCompendiumMoveBuilder()
			.withName("Barkskin")
			.build();  // non-starting; _id = "barkskin"
		const repo = new FakeMoveRepository([acquiredMove]);
		const playbookItem = {
			_id: "pb1", type: "playbook", name: "The Blessed",
			system: { slug: "the-blessed", startingMovesNote: null, moves: ["barkskin"], startingMoves: [] },
		};
		const actor = makeActor(
			{ "moves.categories": [
				{ key: "playbook-the-blessed", moves: [
					{ slug: "barkskin", compendiumId: "barkskin", isStarting: false, selection: { max: 1, value: 1 }, ownedIds: ["old-id"] },
				]},
			]},
			[playbookItem],
		);
		await migrateCharacterMoves(actor, repo);
		const update = actor.updatedDocs.find(u => u.system?.acquired === true);
		expect(update).toBeDefined();
		expect(update.system.instanceCount).toBe(1);
	});

	it("does not update non-starting moves with selection.value = 0", async () => {
		const unacquiredMove = new FakeCompendiumMoveBuilder()
			.withName("Lightning Rod")
			.build();
		const repo = new FakeMoveRepository([unacquiredMove]);
		const playbookItem = {
			_id: "pb1", type: "playbook", name: "The Blessed",
			system: { slug: "the-blessed", startingMovesNote: null, moves: ["lightning-rod"], startingMoves: [] },
		};
		const actor = makeActor(
			{ "moves.categories": [
				{ key: "playbook-the-blessed", moves: [
					{ slug: "lightning-rod", compendiumId: "lightning-rod", isStarting: false, selection: { max: 1, value: 0 }, ownedIds: [] },
				]},
			]},
			[playbookItem],
		);
		await migrateCharacterMoves(actor, repo);
		const acquiredUpdate = actor.updatedDocs.find(u => u.system?.acquired === true);
		expect(acquiredUpdate).toBeUndefined();
	});

	it("skips moves with no compendiumId", async () => {
		const move = new FakeCompendiumMoveBuilder().withName("Barkskin").build();
		const repo = new FakeMoveRepository([move]);
		const playbookItem = {
			_id: "pb1", type: "playbook", name: "The Blessed",
			system: { slug: "the-blessed", startingMovesNote: null, moves: ["barkskin"], startingMoves: [] },
		};
		const actor = makeActor(
			{ "moves.categories": [
				{ key: "playbook-the-blessed", moves: [
					{ slug: "barkskin", compendiumId: null, isStarting: false, selection: { max: 1, value: 1 }, ownedIds: ["old-id"] },
				]},
			]},
			[playbookItem],
		);
		await migrateCharacterMoves(actor, repo);
		const acquiredUpdate = actor.updatedDocs.find(u => u.system?.acquired === true);
		expect(acquiredUpdate).toBeUndefined();
	});
});

// ── no flag data ──────────────────────────────────────────────────────────────

describe("migrateCharacterMoves — no flag data", () => {
	it("still runs initBasicMoves when no categories flag exists", async () => {
		const basicDoc = new FakeCompendiumMoveBuilder().withName("Defy Danger").asStarting().build();
		const repo = new FakeMoveRepository([], [basicDoc]);
		const actor = makeActor({}, []);
		await migrateCharacterMoves(actor, repo);
		const created = actor.createdDocs.find(d => d.name === "Defy Danger");
		expect(created).toBeDefined();
	});
});

// ── reference categories added after the character was made ───────────────────

// Expedition moves shipped after characters already existed. The flag-era migration above bails for
// anyone already on embedded moves, so this is what actually reaches them.
describe("migrateReferenceMoveCategories", () => {
	const REFERENCE_DOCS = [
		new FakeCompendiumMoveBuilder().withName("Defy Danger").withMoveType("basic").asStarting().build(),
		new FakeCompendiumMoveBuilder().withName("Make Camp").withMoveType("expedition").asStarting().build(),
		new FakeCompendiumMoveBuilder().withName("Chart a Course").withMoveType("expedition").asStarting().build(),
		new FakeCompendiumMoveBuilder().withName("Death's Door").withMoveType("special").asStarting().build(),
		new FakeCompendiumMoveBuilder().withName("Order Followers").withMoveType("follower").asStarting().build(),
	];

	const makeRepo = () => new FakeMoveRepository([], [...REFERENCE_DOCS]);

	// A character migrated before expedition existed: every other reference category is embedded.
	function makeMigratedActor(extraItems = []) {
		return makeActor({}, [
			{ _id: "m-basic",    type: "move", name: "Defy Danger",     system: { slug: "defy-danger", categoryKey: "basic" } },
			{ _id: "m-special",  type: "move", name: "Death's Door",    system: { slug: "deaths-door", categoryKey: "special" } },
			{ _id: "m-follower", type: "move", name: "Order Followers", system: { slug: "order-followers", categoryKey: "follower" } },
			...extraItems,
		]);
	}

	const createdNames = (actor) => actor.createdDocs.map(d => d.name);

	it("seeds the missing expedition category", async () => {
		const actor = makeMigratedActor();
		await migrateReferenceMoveCategories(actor, makeRepo());
		expect(createdNames(actor)).toEqual(expect.arrayContaining(["Make Camp", "Chart a Course"]));
	});

	it("stamps the seeded moves with the expedition category, acquired", async () => {
		const actor = makeMigratedActor();
		await migrateReferenceMoveCategories(actor, makeRepo());
		const created = actor.createdDocs.find(d => d.name === "Make Camp");
		expect(created.system.categoryKey).toBe("expedition");
		expect(created.system.acquired).toBe(true);
	});

	it("leaves the categories the character already has alone", async () => {
		const actor = makeMigratedActor();
		await migrateReferenceMoveCategories(actor, makeRepo());
		expect(createdNames(actor)).not.toContain("Defy Danger");
		expect(createdNames(actor)).not.toContain("Death's Door");
	});

	it("adds nothing on a second run", async () => {
		const actor = makeMigratedActor();
		await migrateReferenceMoveCategories(actor, makeRepo());
		const afterFirst = actor.createdDocs.length;
		await migrateReferenceMoveCategories(actor, makeRepo());
		expect(actor.createdDocs).toHaveLength(afterFirst);
	});

	// The GM deleted one expedition move on purpose. The category still has the other, so the
	// migration must not top it back up.
	it("does not restore a single move deleted from a category the character still has", async () => {
		const actor = makeMigratedActor([
			{ _id: "m-camp", type: "move", name: "Make Camp", system: { slug: "make-camp", categoryKey: "expedition" } },
		]);
		await migrateReferenceMoveCategories(actor, makeRepo());
		expect(createdNames(actor)).not.toContain("Chart a Course");
	});

	it("seeds every category for a character carrying no moves at all", async () => {
		const actor = makeActor({}, []);
		await migrateReferenceMoveCategories(actor, makeRepo());
		expect(createdNames(actor).sort())
			.toEqual(["Chart a Course", "Death's Door", "Defy Danger", "Make Camp", "Order Followers"]);
	});
});

// ── a move added to a category the character already has ──────────────────────

// Seek Insight joined the basic moves after every existing character was made. The category-level
// migration above skips them (they have basic moves), so this is what reaches them.
describe("migrateAddedReferenceMoves", () => {
	const REFERENCE_DOCS = [
		new FakeCompendiumMoveBuilder().withName("Defy Danger").withMoveType("basic").build(),
		new FakeCompendiumMoveBuilder().withName("Seek Insight").withMoveType("basic").build(),
		new FakeCompendiumMoveBuilder().withName("Know Things").withMoveType("basic").build(),
	];

	const makeRepo = () => new FakeMoveRepository([], [...REFERENCE_DOCS]);

	// A pre-0.14.2 character: the basic moves as they were, minus Seek Insight.
	function makeCharacterWithoutSeekInsight(extraItems = []) {
		return makeActor({}, [
			{ _id: "m-defy", type: "move", name: "Defy Danger", system: { slug: "defy-danger", categoryKey: "basic" } },
			{ _id: "m-know", type: "move", name: "Know Things", system: { slug: "know-things", categoryKey: "basic" } },
			...extraItems,
		]);
	}

	const createdNames = (actor) => actor.createdDocs.map(d => d.name);

	it("seeds Seek Insight into the basic category", async () => {
		const actor = makeCharacterWithoutSeekInsight();
		await migrateAddedReferenceMoves(actor, makeRepo());
		expect(createdNames(actor)).toEqual(["Seek Insight"]);
		expect(actor.createdDocs[0].system.categoryKey).toBe("basic");
		expect(actor.createdDocs[0].system.acquired).toBe(true);
	});

	it("adds nothing on a second run", async () => {
		const actor = makeCharacterWithoutSeekInsight();
		await migrateAddedReferenceMoves(actor, makeRepo());
		await migrateAddedReferenceMoves(actor, makeRepo());
		expect(actor.createdDocs).toHaveLength(1);
	});

	// The GM deleted Defy Danger on purpose; only the named slug may come back.
	it("does not restore other basic moves the character is missing", async () => {
		const actor = makeActor({}, [
			{ _id: "m-know", type: "move", name: "Know Things", system: { slug: "know-things", categoryKey: "basic" } },
		]);
		await migrateAddedReferenceMoves(actor, makeRepo());
		expect(createdNames(actor)).not.toContain("Defy Danger");
	});

	it("does not duplicate a Seek Insight the player already dragged in", async () => {
		const actor = makeCharacterWithoutSeekInsight([
			{ _id: "m-dropped", type: "move", name: "Seek Insight", system: { slug: "seek-insight", categoryKey: "other" } },
		]);
		await migrateAddedReferenceMoves(actor, makeRepo());
		expect(actor.createdDocs).toHaveLength(0);
	});
});
