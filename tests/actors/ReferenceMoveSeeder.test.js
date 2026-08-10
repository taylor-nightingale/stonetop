import { describe, it, expect } from "vitest";
import { ReferenceMoveSeeder } from "../../src/actors/ReferenceMoveSeeder.js";
import { FakeMoveRepository } from "../fakes/FakeMoveRepository.js";
import { FakeCompendiumMoveBuilder } from "../fakes/FakeCompendiumMoveBuilder.js";
import { FakeSteadingBuilder } from "../fakes/FakeSteadingBuilder.js";

function move(name, moveType) {
	return new FakeCompendiumMoveBuilder().withName(name).withMoveType(moveType).build();
}

function makeSeeder(...packMoves) {
	const repo  = new FakeMoveRepository();
	packMoves.forEach(m => repo.addBasic(m));
	const actor = new FakeSteadingBuilder().build();
	return { seeder: new ReferenceMoveSeeder(actor, repo), actor };
}

const embedded = (actor, categoryKey) =>
	[...actor.items].filter(i => i.system?.categoryKey === categoryKey);

describe("ReferenceMoveSeeder.seed", () => {
	it("embeds each reference move of the category, acquired and category-stamped", async () => {
		const { seeder, actor } = makeSeeder(move("Trade", "homefront"), move("Stand Watch", "homefront"));
		await seeder.seed("homefront");
		const seeded = embedded(actor, "homefront");
		expect(seeded).toHaveLength(2);
		expect(seeded.every(i => i.system.acquired === true && i.system.instanceCount === 1)).toBe(true);
	});

	it("seeds only the requested category", async () => {
		const { seeder, actor } = makeSeeder(move("Trade", "homefront"), move("Defend", "basic"));
		await seeder.seed("basic");
		expect(embedded(actor, "basic").map(i => i.name)).toEqual(["Defend"]);
		expect(embedded(actor, "homefront")).toHaveLength(0);
	});

	it("is idempotent — a re-seed adds no duplicates", async () => {
		const { seeder, actor } = makeSeeder(move("Trade", "homefront"));
		await seeder.seed("homefront");
		await seeder.seed("homefront");
		expect(embedded(actor, "homefront")).toHaveLength(1);
	});

	it("recognizes a RENAMED embedded move by its stored slug and does not re-add it", async () => {
		// The GM renaming a seeded move must not resurrect the original on the next seed — the
		// stored system.slug, not the display name, is what identifies the move.
		const { seeder, actor } = makeSeeder(move("Trade", "homefront"));
		await seeder.seed("homefront");
		actor.items[0].name = "Bartering (house rules)";
		await seeder.seed("homefront");
		expect(embedded(actor, "homefront")).toHaveLength(1);
	});

	it("falls back to the name-derived slug for embedded moves without a stored slug", async () => {
		const { seeder, actor } = makeSeeder(move("Trade", "homefront"));
		await seeder.seed("homefront");
		delete actor.items[0].system.slug;
		await seeder.seed("homefront");
		expect(embedded(actor, "homefront")).toHaveLength(1);
	});

	it("does nothing when the category has no reference moves", async () => {
		const { seeder, actor } = makeSeeder();
		await seeder.seed("homefront");
		expect([...actor.items]).toHaveLength(0);
	});
});

// A reference move added to the packs after the category shipped: the actor already has the
// category, so only the named slug may be topped up.
describe("ReferenceMoveSeeder.seedSlugs", () => {
	const basicPack = () => makeSeeder(
		move("Defy Danger", "basic"),
		move("Seek Insight", "basic"),
		move("Know Things", "basic"),
	);

	it("embeds only the named slug, category-stamped and acquired", async () => {
		const { seeder, actor } = basicPack();
		await seeder.seedSlugs("basic", ["seek-insight"]);
		const seeded = embedded(actor, "basic");
		expect(seeded.map(i => i.name)).toEqual(["Seek Insight"]);
		expect(seeded[0].system.acquired).toBe(true);
		expect(seeded[0].system.instanceCount).toBe(1);
	});

	it("leaves the category's other missing moves alone", async () => {
		const { seeder, actor } = basicPack();
		await seeder.seedSlugs("basic", ["seek-insight"]);
		expect(embedded(actor, "basic").map(i => i.name)).not.toContain("Defy Danger");
	});

	it("is idempotent — a re-seed adds no duplicate", async () => {
		const { seeder, actor } = basicPack();
		await seeder.seedSlugs("basic", ["seek-insight"]);
		await seeder.seedSlugs("basic", ["seek-insight"]);
		expect(embedded(actor, "basic")).toHaveLength(1);
	});

	// Dragged in by hand it lands under "other"; a second copy in the sidebar is a duplicate.
	it("does not re-add a move the actor already has under another category", async () => {
		const { seeder, actor } = basicPack();
		actor.items.push({ _id: "dropped", type: "move", name: "Seek Insight", system: { slug: "seek-insight", categoryKey: "other" } });
		await seeder.seedSlugs("basic", ["seek-insight"]);
		expect(embedded(actor, "basic")).toHaveLength(0);
	});

	it("ignores a slug the pack category does not have", async () => {
		const { seeder, actor } = basicPack();
		await seeder.seedSlugs("basic", ["not-a-move"]);
		expect(embedded(actor, "basic")).toHaveLength(0);
	});
});
