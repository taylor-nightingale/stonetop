import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock only the pack-touching pieces; the seeding flow stays real (FakeMoveRepository below).
vi.mock("../../../src/actors/steading/applySteadfast.js", async importOriginal => {
	const actual = await importOriginal();
	return {
		...actual,
		applySteadfast: vi.fn(async () => {}),
		seedSteadfast:  vi.fn(async () => {}),
		loadSteadfast:  vi.fn(async () => null),
	};
});

import { StonetopSteading } from "../../../src/actors/steading/StonetopSteading.js";
import { applySteadfast, loadSteadfast, seedSteadfast } from "../../../src/actors/steading/applySteadfast.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";
import { FakeMoveRepository } from "../../fakes/FakeMoveRepository.js";
import { FakeCompendiumMoveBuilder } from "../../fakes/FakeCompendiumMoveBuilder.js";
import { steadingRepos } from "../../fakes/FakeSteadingRepos.js";

// The steading's own creation logic (CreateActor hook → typedActor.onCreate): default steadfast
// for a brand-new steading, then the homefront reference-move seed.

function make({ steadfast = "" } = {}) {
	const actor = new FakeSteadingBuilder().withSteadfast(steadfast).build();
	const repo  = new FakeMoveRepository().addBasic(
		new FakeCompendiumMoveBuilder().withName("Trade").withMoveType("homefront").build()
	);
	return { steading: new StonetopSteading(actor, steadingRepos({ improvements: { getBySlug: async () => null }, moves: repo })), actor };
}

const homefrontItems = actor => [...actor.items].filter(i => i.system?.categoryKey === "homefront");

beforeEach(() => {
	applySteadfast.mockClear();
	seedSteadfast.mockClear();
	loadSteadfast.mockReset();
	loadSteadfast.mockResolvedValue(null);
});

describe("StonetopSteading.onCreate", () => {
	it("seeds the Stonetop steadfast into a brand-new steading and seeds its homefront moves", async () => {
		const stonetop = { type: "steadfast", name: "Stonetop" };
		loadSteadfast.mockResolvedValue(stonetop);
		const { steading, actor } = make({ steadfast: "" });

		await steading.onCreate();

		expect(loadSteadfast).toHaveBeenCalledWith("stonetop");
		// Seeded, not applied: creation keeps the name the GM typed (see seedSteadfast).
		expect(seedSteadfast).toHaveBeenCalledWith(actor, stonetop);
		expect(applySteadfast).not.toHaveBeenCalled();
		expect(homefrontItems(actor)).toHaveLength(1);
	});

	it("leaves an existing steadfast alone (duplicated/imported steading) but still seeds moves", async () => {
		const { steading, actor } = make({ steadfast: "barrier-pass" });

		await steading.onCreate();

		expect(loadSteadfast).not.toHaveBeenCalled();
		expect(seedSteadfast).not.toHaveBeenCalled();
		expect(homefrontItems(actor)).toHaveLength(1);
	});

	it("survives a missing steadfast pack and still seeds moves", async () => {
		const { steading, actor } = make({ steadfast: "" });

		await steading.onCreate();

		expect(seedSteadfast).not.toHaveBeenCalled();
		expect(homefrontItems(actor)).toHaveLength(1);
	});
});
