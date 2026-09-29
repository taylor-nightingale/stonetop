import { describe, expect, it } from "vitest";
import { migrateMovePackData } from "../../src/migration/migrateMovePackData.js";
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

	// The bug this refresh was extended for: the Seasons Change steps were added to the pack after
	// steadings were already in play, and an embedded copy carrying [] makes the Season tab fall
	// back to a single "roll it" with no picks.
	it("refreshes a move's steps", async () => {
		const steps = [{ kind: "roll", die: "1d4", stat: "population" }, { kind: "consume" }];
		const doc = new FakeCompendiumMoveBuilder().withName("Deaths Door").withSteps(steps).build();
		const actor = makeActor([embeddedMove({ steps: [] })]);
		await migrateMovePackData(actor, makeRepo(doc));
		expect(updateFor(actor).system.steps).toEqual(steps);
	});

	// The same staleness as the steps: Armored was authored with its shield after characters were
	// already carrying one, and a Heavy who took it would otherwise still mark ◇◇.
	it("refreshes what a move does to the character's gear", async () => {
		const outfitEffects = [{ slug: "shield", weight: 1 }];
		const doc = new FakeCompendiumMoveBuilder().withName("Deaths Door").withOutfitEffects(outfitEffects).build();
		const actor = makeActor([embeddedMove({ outfitEffects: [] })]);
		await migrateMovePackData(actor, makeRepo(doc));
		expect(updateFor(actor).system.outfitEffects).toEqual(outfitEffects);
	});

	it("empties the gear effects of a move the pack no longer gives any", async () => {
		const actor = makeActor([embeddedMove({ outfitEffects: [{ slug: "shield", weight: 1 }] })]);
		await migrateMovePackData(actor, makeRepo(packDeathsDoor()));
		expect(updateFor(actor).system.outfitEffects).toEqual([]);
	});

	it("empties the steps of a move the pack no longer gives any", async () => {
		const actor = makeActor([embeddedMove({ steps: [{ kind: "roll" }] })]);
		await migrateMovePackData(actor, makeRepo(packDeathsDoor()));
		expect(updateFor(actor).system.steps).toEqual([]);
	});

	// The pack's art. The four Seasons Change moves were the only moves in the pack carrying an icon;
	// removing them left every world in play still showing the old PNGs, because nothing refreshed
	// `img`. A rename is preserved below — an icon is not a rename.
	it("refreshes the move's icon from the pack", async () => {
		const doc = new FakeCompendiumMoveBuilder().withName("Deaths Door").build();
		doc.img = "icons/svg/item-bag.svg";
		const actor = makeActor([{ ...embeddedMove(), img: "systems/stonetop/assets/old.png" }]);
		await migrateMovePackData(actor, makeRepo(doc));
		expect(updateFor(actor).img).toBe("icons/svg/item-bag.svg");
	});

	// Tethered's blank for what the Ghost is bound to was added after Ghosts were already in play.
	it("refreshes a move's choice group", async () => {
		const choices = { slug: "choices", list: [{ type: "entry", slug: "tether", input: { type: "inline" } }] };
		const doc = new FakeCompendiumMoveBuilder().withName("Tethered").withChoices(choices).build();
		const actor = makeActor([embeddedMove({ slug: "tethered", choices: null })]);
		await migrateMovePackData(actor, makeRepo(doc));
		expect(updateFor(actor).system.choices).toEqual(choices);
	});

	// The rail groups the expedition moves by the part of the journey each is for.
	it("refreshes the part of an expedition a move is for", async () => {
		const doc = new FakeCompendiumMoveBuilder().withName("Forage").withPhase("on-the-road").build();
		const actor = makeActor([embeddedMove({ slug: "forage" })]);
		await migrateMovePackData(actor, makeRepo(doc));
		expect(updateFor(actor).system.phase).toBe("on-the-road");
	});

	// At zero HP the rail offers a death insert's own move where Death's Door would be.
	it("refreshes which move a move is made instead of", async () => {
		const doc = new FakeCompendiumMoveBuilder().withName("Undying").withReplaces("deaths-door").build();
		const actor = makeActor([embeddedMove({ slug: "undying" })]);
		await migrateMovePackData(actor, makeRepo(doc));
		expect(updateFor(actor).system.replaces).toBe("deaths-door");
	});

	it("clears a phase and a replacement the pack no longer gives", async () => {
		const actor = makeActor([embeddedMove({ phase: "setting-out", replaces: "deaths-door" })]);
		await migrateMovePackData(actor, makeRepo(packDeathsDoor()));
		expect(updateFor(actor).system.phase).toBeNull();
		expect(updateFor(actor).system.replaces).toBeNull();
	});

	// moveType is the reference category a move is filed under, so a stale one draws the move in the
	// wrong section of the sheet.
	it("refreshes the move type", async () => {
		const doc = new FakeCompendiumMoveBuilder().withName("Deaths Door").withMoveType("seasons").build();
		const actor = makeActor([embeddedMove({ moveType: "homefront" })]);
		await migrateMovePackData(actor, makeRepo(doc));
		expect(updateFor(actor).system.moveType).toBe("seasons");
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
