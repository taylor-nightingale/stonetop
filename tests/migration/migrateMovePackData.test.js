import { describe, expect, it } from "vitest";
import { migrateMovePackData } from "../../src/migration/migrateCharacter.js";
import { FakeCharacterActorBuilder } from "../fakes/FakeCharacterActorBuilder.js";
import { FakeMoveRepository } from "../fakes/FakeMoveRepository.js";
import { FakeCompendiumMoveBuilder } from "../fakes/FakeCompendiumMoveBuilder.js";

// An embedded move is a copy taken when it was seeded, so pack fixes never reach a character in
// play — and reference moves can't be deleted and re-dragged to pick them up. This refresh is the
// only route, so what it must NOT touch (the player's state) matters as much as what it refreshes.

function makeActor(items) {
	return new FakeCharacterActorBuilder().withItems(items).build();
}

// A move as it sits on a character mid-campaign: old text, and state the player put there.
function embeddedMove(overrides = {}) {
	return {
		_id: "m1", type: "move", name: "Deaths Door",
		system: {
			slug: "deaths-door",
			description: "gain the Revenant or Ghost insert",
			categoryKey: "special", categoryLabel: "Special Moves", categoryNote: null,
			acquired: true, instanceCount: 2, sortOrder: 3, compendiumId: "packid",
			pickValues: { someGroup: { picked: ["a"] } },
			...overrides,
		},
	};
}

const LINKED = "gain the @UUID[Compendium.stonetop.inserts.Item.7Dfeu35drOu1VYyA]{Revenant} insert";

function makeRepo(...docs) {
	return new FakeMoveRepository([], docs);
}

const packDeathsDoor = () => new FakeCompendiumMoveBuilder()
	.withName("Deaths Door")
	.withMoveType("special")
	.withDescription(LINKED)
	.build();

const updateFor = (actor, id = "m1") => actor.updatedDocs.find(u => u._id === id);

describe("migrateMovePackData — refreshes authored fields", () => {
	it("replaces the description with the pack's", async () => {
		const actor = makeActor([embeddedMove()]);
		await migrateMovePackData(actor, makeRepo(packDeathsDoor()));
		expect(updateFor(actor).system.description).toBe(LINKED);
	});

	it("refreshes the result tiers", async () => {
		const doc = new FakeCompendiumMoveBuilder()
			.withName("Deaths Door")
			.withMoveResults({ failure: { label: "6-", value: LINKED } })
			.build();
		const actor = makeActor([embeddedMove()]);
		await migrateMovePackData(actor, makeRepo(doc));
		expect(updateFor(actor).system.moveResults.failure.value).toBe(LINKED);
	});

	it("refreshes the roll stat", async () => {
		const doc = new FakeCompendiumMoveBuilder().withName("Deaths Door").withRollStat("prompt").build();
		const actor = makeActor([embeddedMove({ rollStat: null })]);
		await migrateMovePackData(actor, makeRepo(doc));
		expect(updateFor(actor).system.rollStat).toBe("prompt");
	});

	// Requisition says "don't mark XP" on a 6-; a stale copy would keep offering the button.
	it("carries a move's xpOnMiss: false through", async () => {
		const doc = new FakeCompendiumMoveBuilder().withName("Deaths Door").build();
		doc.system.xpOnMiss = false;
		const actor = makeActor([embeddedMove()]);
		await migrateMovePackData(actor, makeRepo(doc));
		expect(updateFor(actor).system.xpOnMiss).toBe(false);
	});

	it("defaults xpOnMiss to true for a move that doesn't say otherwise", async () => {
		const actor = makeActor([embeddedMove()]);
		await migrateMovePackData(actor, makeRepo(packDeathsDoor()));
		expect(updateFor(actor).system.xpOnMiss).toBe(true);
	});
});

describe("migrateMovePackData — leaves the player's state alone", () => {
	it("writes none of the state fields, so Foundry's merge preserves them", async () => {
		const actor = makeActor([embeddedMove()]);
		await migrateMovePackData(actor, makeRepo(packDeathsDoor()));
		const written = Object.keys(updateFor(actor).system);
		for (const field of ["acquired", "instanceCount", "categoryKey", "categoryLabel",
			"categoryNote", "sortOrder", "compendiumId", "pickValues", "slug"]) {
			expect(written, `${field} must not be rewritten`).not.toContain(field);
		}
	});

	it("does not rename the item, so a GM rename survives", async () => {
		const actor = makeActor([embeddedMove()]);
		await migrateMovePackData(actor, makeRepo(packDeathsDoor()));
		expect(updateFor(actor)).not.toHaveProperty("name");
	});
});

describe("migrateMovePackData — scope", () => {
	it("skips a homebrew move the pack has never heard of", async () => {
		const actor = makeActor([embeddedMove({ slug: "cat-nap" })]);
		await migrateMovePackData(actor, makeRepo(packDeathsDoor()));
		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("skips a move item carrying no slug", async () => {
		const actor = makeActor([{ _id: "m1", type: "move", name: "Deaths Door", system: {} }]);
		await migrateMovePackData(actor, makeRepo(packDeathsDoor()));
		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("ignores items that are not moves", async () => {
		const actor = makeActor([{ _id: "p1", type: "possession", name: "A knife", system: { slug: "deaths-door" } }]);
		await migrateMovePackData(actor, makeRepo(packDeathsDoor()));
		expect(actor.updatedDocs).toHaveLength(0);
	});

	it("refreshes every matching move on the character in one update call", async () => {
		const forage = new FakeCompendiumMoveBuilder()
			.withName("Forage").withMoveType("expedition").withDescription("fresh forage").build();
		const actor = makeActor([
			embeddedMove(),
			{ _id: "m2", type: "move", name: "Forage", system: { slug: "forage", description: "stale" } },
		]);
		await migrateMovePackData(actor, makeRepo(packDeathsDoor(), forage));
		expect(actor.updatedDocs.map(u => u._id)).toEqual(["m1", "m2"]);
		expect(updateFor(actor, "m2").system.description).toBe("fresh forage");
	});

	it("is idempotent — a second run writes the same values", async () => {
		const actor = makeActor([embeddedMove()]);
		await migrateMovePackData(actor, makeRepo(packDeathsDoor()));
		await migrateMovePackData(actor, makeRepo(packDeathsDoor()));
		expect(actor.updatedDocs.every(u => u.system.description === LINKED)).toBe(true);
	});
});
