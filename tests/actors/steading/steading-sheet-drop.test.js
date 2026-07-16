// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { createStonetopSteadingSheetClass } from "../../../src/actors/steading/StonetopSteadingSheet.js";

// The sheet does NOT wire drop listeners — core ActorSheetV2 does (element.ondrop → _onDrop →
// _onDropDocument → _onDropItem). The sheet only overrides _onDropItem, delegating the decision to
// the typed steading. This fake base mimics core's wiring so the integration test below proves a
// physical drop event reaches the route EXACTLY once (the double-handled-drop regression).
class FakeCoreActorSheetBase {
	constructor(actor) {
		this.actor = actor;
		this.element = document.createElement("form");
		// Core binds in _onRender via DragDrop, which ASSIGNS element.ondrop (no stacking).
		this.element.ondrop = ev => this._onDrop(ev);
	}
	tabGroups = {};
	isEditable = true;
	async _onFirstRender() {}
	_onRender() {}
	async _onDrop(event) {
		await this._onDropDocument(event, event._testDroppedItem);
	}
	async _onDropDocument(event, item) {
		return this._onDropItem(event, item);
	}
	// Core's default embed for items the subclass doesn't intercept.
	async _onDropItem(event, item) {
		await this.actor.createEmbeddedDocuments("Item", [item.toObject()]);
		return item;
	}
}

const StonetopSteadingSheet = createStonetopSteadingSheetClass(FakeCoreActorSheetBase);

function makeSheet({ editable = true } = {}) {
	const typedSteading = { applyDroppedItem: vi.fn(async () => false) };
	const actor = {
		typedActor: typedSteading, name: "Stonetop", system: { steadfast: "" },
		createEmbeddedDocuments: vi.fn(async () => {}),
	};
	const sheet = new StonetopSteadingSheet(actor);
	sheet.isEditable = editable;
	return { sheet, typedSteading, actor };
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
