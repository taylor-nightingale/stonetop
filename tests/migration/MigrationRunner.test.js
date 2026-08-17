import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const migrateCharacter = vi.fn(async () => {});

vi.mock("../../src/migration/migrateCharacter.js", () => ({
	migrateCharacter: (...args) => migrateCharacter(...args),
}));
vi.mock("../../src/migration/migrateNpc.js",           () => ({ migrateNpc:      async () => {} }));
vi.mock("../../src/migration/migrateSteading.js",      () => ({ migrateSteading: async () => {} }));
vi.mock("../../src/migration/migrateSteadingMoves.js", () => ({ migrateSteadingMoves: async () => {} }));
vi.mock("../../src/migration/migrateWorldItems.js",    () => ({ migrateWorldItems: async () => {} }));
vi.mock("../../src/migration/migrateGrantStamps.js",   () => ({ migrateGrantStamps: async () => {} }));
vi.mock("../../src/actors/character/repositories/FoundryInsertRepository.js", () => ({
	FoundryInsertRepository: class {},
}));

import { MigrationRunner } from "../../src/migration/MigrationRunner.js";

function character(name) {
	return { name, type: "character", getFlag: () => ({}), setFlag: async () => {} };
}

beforeEach(() => {
	migrateCharacter.mockClear();
	migrateCharacter.mockImplementation(async () => {});
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
