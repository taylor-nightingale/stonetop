import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the applySteadfast module so we can assert the drop routes a steadfast to it (and only it).
vi.mock("../../../src/actors/steading/applySteadfast.js", () => ({
	applySteadfast:    vi.fn(async () => {}),
	loadSteadfast:     vi.fn(async () => null),
	loadAllSteadfasts: vi.fn(async () => []),
}));

import { createStonetopSteadingSheetClass } from "../../../src/actors/steading/StonetopSteadingSheet.js";
import { applySteadfast } from "../../../src/actors/steading/applySteadfast.js";

// A minimal ActorSheet base: its _onDropItem stands in for Foundry's default embed-the-item behaviour.
class FakeBase {
	constructor(actor) { this.actor = actor; }
	async _onDropItem(event, data) { FakeBase.superDrop(event, data); return "embedded"; }
	activateListeners() {}
}
FakeBase.superDrop = vi.fn();

const StonetopSteadingSheet = createStonetopSteadingSheetClass(FakeBase);

function makeSheet({ editable = true } = {}) {
	const actor = { typedActor: {}, system: { steadfast: "" }, update: vi.fn(async () => {}) };
	const sheet = new StonetopSteadingSheet(actor);
	sheet.isEditable = editable;
	return sheet;
}

describe("StonetopSteadingSheet._onDropItem", () => {
	beforeEach(() => {
		vi.stubGlobal("Item", { implementation: { fromDropData: vi.fn() } });
		applySteadfast.mockClear();
		FakeBase.superDrop.mockClear();
	});
	afterEach(() => vi.unstubAllGlobals());

	it("applies a dropped steadfast to the steading instead of embedding it", async () => {
		const steadfast = { type: "steadfast", name: "Barrier Pass", system: { slug: "barrier-pass" } };
		Item.implementation.fromDropData.mockResolvedValue(steadfast);
		const sheet = makeSheet();

		await sheet._onDropItem({}, { type: "Item", uuid: "x" });

		expect(applySteadfast).toHaveBeenCalledWith(sheet.actor, steadfast);
		expect(FakeBase.superDrop).not.toHaveBeenCalled(); // not embedded
	});

	it("does not apply a steadfast when the sheet is not editable", async () => {
		Item.implementation.fromDropData.mockResolvedValue({ type: "steadfast", system: { slug: "x" } });
		const sheet = makeSheet({ editable: false });

		await sheet._onDropItem({}, { type: "Item" });

		expect(applySteadfast).not.toHaveBeenCalled();
		expect(FakeBase.superDrop).not.toHaveBeenCalled();
	});

	it("falls through to the default drop for a non-steadfast item", async () => {
		const move = { type: "move", name: "Sneak" };
		Item.implementation.fromDropData.mockResolvedValue(move);
		const sheet = makeSheet();

		const result = await sheet._onDropItem({ e: 1 }, { type: "Item" });

		expect(applySteadfast).not.toHaveBeenCalled();
		expect(FakeBase.superDrop).toHaveBeenCalledWith({ e: 1 }, { type: "Item" });
		expect(result).toBe("embedded");
	});
});
