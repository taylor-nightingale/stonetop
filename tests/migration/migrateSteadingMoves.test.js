import { describe, expect, it } from "vitest";
import { migrateSteadingMoves } from "../../src/migration/migrateSteadingMoves.js";
import { StonetopSteading } from "../../src/actors/steading/StonetopSteading.js";
import { FakeSteadingBuilder } from "../fakes/FakeSteadingBuilder.js";
import { FakeMoveRepository } from "../fakes/FakeMoveRepository.js";
import { FakeCompendiumMoveBuilder } from "../fakes/FakeCompendiumMoveBuilder.js";

const compendiumMove = (name, moveType) =>
	new FakeCompendiumMoveBuilder().withName(name).withMoveType(moveType).build();

function steadingWith(...compendiumMoves) {
	const repo = new FakeMoveRepository();
	compendiumMoves.forEach(m => repo.addBasic(m));
	const actor = new FakeSteadingBuilder()
		.withTypedActor(a => new StonetopSteading(a, { getBySlug: async () => null }, repo))
		.build();
	return actor;
}

const movesIn = (actor, key) => [...actor.items].filter(i => i.system?.categoryKey === key);

describe("migrateSteadingMoves", () => {
	it("backfills a move that joined the compendium after the steading was created", async () => {
		const actor = steadingWith(compendiumMove("Seasons Change: Spring", "seasons"));

		await migrateSteadingMoves(actor);

		expect(movesIn(actor, "seasons").map(i => i.name)).toEqual(["Seasons Change: Spring"]);
	});

	it("is idempotent — a second run adds nothing", async () => {
		const actor = steadingWith(compendiumMove("Trade", "homefront"));

		await migrateSteadingMoves(actor);
		await migrateSteadingMoves(actor);

		expect(movesIn(actor, "homefront")).toHaveLength(1);
	});

	// The four Seasons Change moves shipped under the homefront moveType first. A steading seeded in
	// that window carries them stamped `homefront`, where the seeder can't see them — restamping has
	// to happen first, or the backfill embeds a second copy of each.
	it("re-files a move the packs moved to another category instead of duplicating it", async () => {
		const actor = steadingWith(compendiumMove("Seasons Change: Spring", "seasons"));
		await actor.typedActor.moves.addMove(compendiumMove("Seasons Change: Spring", "homefront"));
		actor.items[0].system.moveType = "seasons";   // the packs re-typed it

		await migrateSteadingMoves(actor);

		expect(movesIn(actor, "homefront")).toHaveLength(0);
		expect(movesIn(actor, "seasons")).toHaveLength(1);
	});

	it("does nothing to an actor that is not a steading", async () => {
		await expect(migrateSteadingMoves({ type: "character" })).resolves.toBeUndefined();
	});
});
