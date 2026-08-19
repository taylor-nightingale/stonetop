// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { createStonetopSteadingSheetClass } from "../../../src/actors/steading/StonetopSteadingSheet.js";
import { stonetopActorSheetBase } from "../../fakes/foundry/stonetopActorSheetBase.js";

// The sheet does NOT wire drop listeners — core ActorSheetV2 does (element.ondrop → _onDrop →
// _onDropDocument → _onDropItem). The sheet only overrides _onDropItem, delegating the decision to
// the typed steading. The shared core-faithful base mimics that wiring, so the integration test below
// proves a physical drop event reaches the route EXACTLY once (the double-handled-drop regression).
const StonetopSteadingSheet = createStonetopSteadingSheetClass(stonetopActorSheetBase());

function makeSheet({ editable = true } = {}) {
	// Flat: the sheet may only call named methods on the typed steading.
	const typedSteading = {
		applyDroppedItem: vi.fn(async () => false),
		linkResident:     vi.fn(async () => {}),
		linkNeighbor:     vi.fn(async () => {}),
		linkPlace:        vi.fn(async () => {}),
	};
	const actor = {
		typedActor: typedSteading, name: "Stonetop", system: { steadfast: "" },
		createEmbeddedDocuments: vi.fn(async () => {}),
	};
	const sheet = new StonetopSteadingSheet(actor);
	sheet.isEditable = editable;
	return { sheet, typedSteading, actor };
}

// Builds a drop event whose target sits inside the given row markup, so `_onDrop*` can walk up to
// the row via `.closest()`.
function dropOnRow(rowHtml, innerSelector) {
	const holder = document.createElement("div");
	holder.innerHTML = rowHtml;
	return { target: holder.querySelector(innerSelector) };
}

describe("StonetopSteadingSheet._onDropItem", () => {
	it("routes the dropped item to the typed steading and stops when handled", async () => {
		const { sheet, typedSteading, actor } = makeSheet();
		typedSteading.applyDroppedItem.mockResolvedValue(true);
		const steadfast = { type: "steadfast", name: "Barrier Pass", toObject: () => ({}) };

		const result = await sheet._onDropItem({}, steadfast);

		expect(typedSteading.applyDroppedItem).toHaveBeenCalledWith(steadfast);
		expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
		expect(result).toBeNull();
	});

	it("falls back to the default embed when the typed steading doesn't handle it", async () => {
		const { sheet, typedSteading, actor } = makeSheet();
		typedSteading.applyDroppedItem.mockResolvedValue(false);
		const possession = { type: "possession", name: "Cart", toObject: () => ({ type: "possession", name: "Cart" }) };

		await sheet._onDropItem({}, possession);

		expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith("Item", [{ type: "possession", name: "Cart" }]);
	});

	it("does nothing when the sheet is not editable", async () => {
		const { sheet, typedSteading, actor } = makeSheet({ editable: false });
		const steadfast = { type: "steadfast", toObject: () => ({}) };

		const result = await sheet._onDropItem({}, steadfast);

		expect(typedSteading.applyDroppedItem).not.toHaveBeenCalled();
		expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
		expect(result).toBeNull();
	});
});

describe("StonetopSteadingSheet._onDropDocument — linking documents to rows", () => {
	const actorDoc   = { documentName: "Actor", uuid: "Actor.abc" };
	const journalDoc = { documentName: "JournalEntry", uuid: "JournalEntry.j1" };
	const itemDoc    = { documentName: "Item", uuid: "Item.i1", type: "possession", toObject: () => ({ type: "possession" }) };

	const residentRow = `<div class="steading-resident-row" data-id="r1"><input class="stonetop-resident-name"></div>`;
	const neighborRow = `<div class="steading-resident-row steading-neighbor-row" data-id="n1"><input class="stonetop-neighbor-person-name"></div>`;
	const placeRow    = `<div class="stonetop-places-row" data-index="2"><input class="stonetop-place-field"></div>`;

	it("links an actor dropped on a resident row", async () => {
		const { sheet, typedSteading } = makeSheet();
		await sheet._onDropDocument(dropOnRow(residentRow, ".stonetop-resident-name"), actorDoc);
		expect(typedSteading.linkResident).toHaveBeenCalledWith("r1", "Actor.abc");
	});

	it("links a journal dropped on a resident row (any document type)", async () => {
		const { sheet, typedSteading } = makeSheet();
		await sheet._onDropDocument(dropOnRow(residentRow, ".stonetop-resident-name"), journalDoc);
		expect(typedSteading.linkResident).toHaveBeenCalledWith("r1", "JournalEntry.j1");
	});

	it("links to the neighbor (not the resident) when the row is a neighbor row", async () => {
		const { sheet, typedSteading } = makeSheet();
		await sheet._onDropDocument(dropOnRow(neighborRow, ".stonetop-neighbor-person-name"), actorDoc);
		expect(typedSteading.linkNeighbor).toHaveBeenCalledWith("n1", "Actor.abc");
		expect(typedSteading.linkResident).not.toHaveBeenCalled();
	});

	it("links a document dropped on a place-of-interest row", async () => {
		const { sheet, typedSteading } = makeSheet();
		await sheet._onDropDocument(dropOnRow(placeRow, ".stonetop-place-field"), journalDoc);
		expect(typedSteading.linkPlace).toHaveBeenCalledWith(2, "JournalEntry.j1");
	});

	it("does not link when the sheet is not editable", async () => {
		const { sheet, typedSteading } = makeSheet({ editable: false });
		await sheet._onDropDocument(dropOnRow(residentRow, ".stonetop-resident-name"), actorDoc);
		expect(typedSteading.linkResident).not.toHaveBeenCalled();
	});

	it("passes a document dropped off any linkable row through to core routing (item embed)", async () => {
		const { sheet, actor, typedSteading } = makeSheet();
		await sheet._onDropDocument({ target: document.createElement("div") }, itemDoc);
		expect(typedSteading.linkResident).not.toHaveBeenCalled();
		expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith("Item", [{ type: "possession" }]);
	});
});

describe("StonetopSteadingSheet — drop wiring (V2 lifecycle integration)", () => {
	it("a physical drop event is handled EXACTLY once (core wires drop; the sheet must not)", async () => {
		// Regression: the sheet once added its own root drop listener on top of core's, so every
		// drop was handled twice (items embedded in duplicate). Fire one real drop through the
		// core-faithful base and count.
		const { sheet, typedSteading } = makeSheet();
		await sheet._onFirstRender({}, {});
		sheet._onRender({}, {});

		const move = { type: "move", name: "Trade", toObject: () => ({ type: "move", name: "Trade" }) };
		const drop = new Event("drop", { bubbles: true, cancelable: true });
		drop._testDroppedItem = move;
		sheet.element.dispatchEvent(drop);
		await new Promise(r => setTimeout(r));

		expect(typedSteading.applyDroppedItem).toHaveBeenCalledTimes(1);
	});
});
