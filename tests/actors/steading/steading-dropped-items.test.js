import { describe, it, expect, vi, beforeEach } from "vitest";

// Keep matchSteadfastByName real (pure); mock only the pack-touching pieces.
vi.mock("../../../src/actors/steading/applySteadfast.js", async importOriginal => {
	const actual = await importOriginal();
	return {
		...actual,
		applySteadfast: vi.fn(async () => {}),
		loadSteadfast:  vi.fn(async () => null),
	};
});

import { StonetopSteading } from "../../../src/actors/steading/StonetopSteading.js";
import { applySteadfast, loadSteadfast } from "../../../src/actors/steading/applySteadfast.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";
import { FakeMoveRepository } from "../../fakes/FakeMoveRepository.js";

function make() {
	const actor = new FakeSteadingBuilder().build();
	const steading = new StonetopSteading(actor, { getBySlug: async () => null }, new FakeMoveRepository());
	return { steading, actor };
}

beforeEach(() => {
	applySteadfast.mockClear();
	loadSteadfast.mockReset();
	loadSteadfast.mockResolvedValue(null);
});

describe("StonetopSteading.applyDroppedItem", () => {
	it("applies a dropped steadfast to the actor and reports handled", async () => {
		const { steading, actor } = make();
		const steadfast = { type: "steadfast", name: "Barrier Pass" };
		expect(await steading.applyDroppedItem(steadfast)).toBe(true);
		expect(applySteadfast).toHaveBeenCalledWith(actor, steadfast);
	});

	it("routes a dropped move into the homefront list and reports handled", async () => {
		const { steading } = make();
		const addMove = vi.spyOn(steading.moves, "addMove").mockResolvedValue();
		const move = { type: "move", name: "Trade" };
		expect(await steading.applyDroppedItem(move)).toBe(true);
		expect(addMove).toHaveBeenCalledWith(move);
	});

	it("reports any other item type unhandled (caller falls back to the default embed)", async () => {
		const { steading } = make();
		expect(await steading.applyDroppedItem({ type: "possession", name: "Cart" })).toBe(false);
		expect(applySteadfast).not.toHaveBeenCalled();
	});
});

describe("StonetopSteading.renameOrApplySteadfast", () => {
	const available = [{ slug: "stonetop", name: "Stonetop" }, { slug: "barrier-pass", name: "Barrier Pass" }];

	it("applies the steadfast whose name matches (case-insensitively)", async () => {
		const { steading, actor } = make();
		const steadfast = { type: "steadfast", name: "Barrier Pass" };
		loadSteadfast.mockResolvedValue(steadfast);

		await steading.renameOrApplySteadfast("  barrier pass ", available);

		expect(loadSteadfast).toHaveBeenCalledWith("barrier-pass");
		expect(applySteadfast).toHaveBeenCalledWith(actor, steadfast);
	});

	it("renames the steading when the value matches no steadfast", async () => {
		const { steading, actor } = make();
		const update = vi.spyOn(actor, "update");

		await steading.renameOrApplySteadfast("New Hamlet", available);

		expect(update).toHaveBeenCalledWith({ name: "New Hamlet" });
		expect(applySteadfast).not.toHaveBeenCalled();
	});

	it("does not rename when the matched steadfast fails to load", async () => {
		const { steading, actor } = make();
		const update = vi.spyOn(actor, "update");

		await steading.renameOrApplySteadfast("Barrier Pass", available);

		expect(applySteadfast).not.toHaveBeenCalled();
		expect(update).not.toHaveBeenCalled();
	});

	it("ignores an empty value and a value equal to the current name", async () => {
		const { steading, actor } = make();
		actor.name = "Stonetop Keep";
		const update = vi.spyOn(actor, "update");

		await steading.renameOrApplySteadfast("   ", available);
		await steading.renameOrApplySteadfast("Stonetop Keep", available);

		expect(update).not.toHaveBeenCalled();
		expect(applySteadfast).not.toHaveBeenCalled();
	});
});
