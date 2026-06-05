import { describe, expect, it } from "vitest";
import { migrateCharacterMoves } from "../../src/migration/migrateCharacter.js";
import { FakeActorBuilder } from "../fakes/FakeActorBuilder.js";
import { FakeMoveRepository } from "../fakes/FakeMoveRepository.js";
import { FakeCompendiumMoveBuilder } from "../fakes/FakeCompendiumMoveBuilder.js";

function makeActor(flags = {}, items = []) {
	const builder = new FakeActorBuilder().withItems(items);
	builder._flagsBuilder.withFlags(flags);
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
