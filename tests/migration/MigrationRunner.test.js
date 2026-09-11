import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const migrateCharacter      = vi.fn(async () => {});
const migrateMovePackData   = vi.fn(async () => {});
const migrateSteadingMoves  = vi.fn(async () => {});

vi.mock("../../src/migration/migrateCharacter.js", () => ({
	migrateCharacter: (...args) => migrateCharacter(...args),
}));
vi.mock("../../src/migration/migrateNpc.js",           () => ({ migrateNpc:      async () => {} }));
vi.mock("../../src/migration/migrateSteading.js",      () => ({ migrateSteading: async () => {} }));
vi.mock("../../src/migration/migrateSteadingMoves.js", () => ({
	migrateSteadingMoves: (...args) => migrateSteadingMoves(...args),
}));
vi.mock("../../src/migration/migrateWorldItems.js",    () => ({ migrateWorldItems: async () => {} }));
vi.mock("../../src/migration/migrateGrantStamps.js",   () => ({ migrateGrantStamps: async () => {} }));
vi.mock("../../src/migration/migrateSteadingFolk.js",  () => ({ migrateSteadingFolk: async () => {} }));
vi.mock("../../src/migration/migrateNeighborPlaces.js", () => ({ migrateNeighborPlaces: async () => {} }));
vi.mock("../../src/migration/migrateSteadingImpressions.js",
	() => ({ migrateSteadingImpressions: async () => {} }));
vi.mock("../../src/migration/migrateSteadingApplied.js", () => ({ migrateSteadingApplied: async () => {} }));
vi.mock("../../src/migration/migrateMovePackData.js", () => ({
	migrateMovePackData: (...args) => migrateMovePackData(...args),
}));
vi.mock("../../src/actors/character/repositories/FoundryInsertRepository.js", () => ({
	FoundryInsertRepository: class {},
}));

import { MigrationRunner } from "../../src/migration/MigrationRunner.js";

function character(name) {
	return { name, type: "character", getFlag: () => ({}), setFlag: async () => {} };
}

function steading(name) {
	return { name, type: "steading" };
}

beforeEach(() => {
	migrateCharacter.mockClear();
	migrateCharacter.mockImplementation(async () => {});
	migrateMovePackData.mockClear();
	migrateSteadingMoves.mockClear();
	vi.stubGlobal("game", { actors: [], packs: { get: () => null }, system: { version: "1.0.3" } });
});

afterEach(() => vi.unstubAllGlobals());

// One actor throwing must not stop the others — but the runner has to SAY it happened, because the
// caller decides from that whether the world is done migrating.
describe("MigrationRunner.run — reporting failures", () => {
	it("reports no failures for a clean run", async () => {
		game.actors = [character("Brakken"), character("Wren")];
		expect(await new MigrationRunner({}).run()).toEqual([]);
	});

	it("names the actor whose migration threw", async () => {
		game.actors = [character("Brakken")];
		migrateCharacter.mockImplementation(async () => { throw new Error("boom"); });
		expect(await new MigrationRunner({}).run()).toEqual(["Brakken"]);
	});

	it("keeps migrating the remaining actors after one throws", async () => {
		game.actors = [character("Brakken"), character("Wren"), character("Kes")];
		migrateCharacter.mockImplementation(async (actor) => {
			if (actor.name === "Brakken") throw new Error("boom");
		});
		expect(await new MigrationRunner({}).run()).toEqual(["Brakken"]);
		expect(migrateCharacter).toHaveBeenCalledTimes(3);
	});
});

// A steading's Seasons Change and homefront moves are embedded copies taken at creation, exactly
// like a character's. The refresh existed but was only ever called down the character branch, so a
// procedure added to the pack never reached a steading already in play.
describe("MigrationRunner.run — steadings", () => {
	it("refreshes a steading's embedded moves from the pack", async () => {
		const place = steading("Stonetop");
		const repos = { moves: { name: "moveRepo" } };
		game.actors = [place];
		await new MigrationRunner(repos).run();
		expect(migrateMovePackData).toHaveBeenCalledWith(place, repos.moves);
	});

	// The backfill's restamp files each move into the category its stored moveType names, and that
	// type is one of the fields the pack refresh corrects. Restamped first, a move whose type changed
	// in the packs is filed from the stale value and nothing re-files it — the Seasons Change moves
	// end up under homefront and the Season tab reports no seasonal moves at all.
	it("refreshes the pack data before backfilling, so the restamp reads a current moveType", async () => {
		const order = [];
		migrateMovePackData.mockImplementation(async () => { order.push("refresh"); });
		migrateSteadingMoves.mockImplementation(async () => { order.push("backfill"); });
		game.actors = [steading("Stonetop")];
		await new MigrationRunner({ moves: {} }).run();
		expect(order).toEqual(["refresh", "backfill"]);
	});

	it("does not refresh moves for an npc", async () => {
		game.actors = [{ name: "A boar", type: "npc" }];
		await new MigrationRunner({}).run();
		expect(migrateMovePackData).not.toHaveBeenCalled();
	});
});
