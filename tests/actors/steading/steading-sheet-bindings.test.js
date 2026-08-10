// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { createStonetopSteadingSheetClass } from "../../../src/actors/steading/StonetopSteadingSheet.js";
import { FakeCoreActorSheetBase } from "../../fakes/foundry/FakeCoreActorSheetBase.js";
import { fire } from "../../fakes/domEvents.js";

// Routes native DOM events to the matching typed-steading method — one representative control per
// tab, plus the delegated (improvement track / move resource) listeners. Mirrors the NPC sheet's
// _onRender binding tests: the real controllers are exercised elsewhere, so a spy typed steading is
// enough to prove the V2 lifecycle wires each control to the right call. Tab navigation is core's
// built-in `tab` action (data-action="tab" in the template) — no sheet wiring to test here.

// FLAT, deliberately: the sheet may only call named methods on the typed steading. A nested spy
// here would mean the sheet was reaching through the steading into its collaborators — the thing
// this shape exists to prevent.
const FACADE_METHODS = [
	"setFortunes", "setSurplus", "setRollMode", "setNotes", "renameOrApplySteadfast",
	"setAttribute", "addAttributeItem", "removeAttributeItem", "updateAttributeItem",
	"setDebility", "updateContentText",
	"addAssetItem", "removeAssetItem", "updateAssetItem",
	"updateCoinagePurses", "updateCoinageHandfuls", "updateCoinageCoins",
	"addResident", "removeResident", "updateResidentName", "updateResidentOccupation",
	"updateResidentTraits", "updateResidentTraitsSource", "unlinkResident", "linkResident",
	"addNeighbor", "removeNeighbor", "updateNeighborName", "updateNeighborOccupation",
	"updateNeighborTraits", "updateNeighborHome", "unlinkNeighbor", "linkNeighbor",
	"updateNeighborPlaceNote",
	"addPlace", "setPlaceValue", "unlinkPlace", "linkPlace",
	"revokeImprovement",
	"setChoiceTrackFor", "setChoicePickFor", "setChoiceTextFor", "clearChoicePickFor",
	"setMoveChecked", "sendMoveToChat", "toggleMoveResourcePip", "setMoveResourceText",
	"pickSeasonalGain",
];

function makeSpySteading() {
	return Object.fromEntries(FACADE_METHODS.map(name => [name, vi.fn()]));
}

async function renderSheet({ editable = true } = {}) {
	const steading = makeSpySteading();
	const actor = { typedActor: steading, name: "Stonetop" };
	const sheet = new (createStonetopSteadingSheetClass(FakeCoreActorSheetBase))(actor);
	sheet.isEditable = editable;
	sheet.element.innerHTML = `
		<input class="steading-steadfast-input" value="Barrier Pass">
		<input class="steading-box-input" name="stonetop-fortunes" value="2">
		<input class="stonetop-resident-name" data-id="r1" value="Cerdig">
		<input class="stonetop-neighbor-person-name" data-id="n1" value="Marock">
		<textarea class="steading-npc-traits-source">gruff
curious</textarea>
		<textarea class="stonetop-notes">a note</textarea>
		<input type="checkbox" class="stonetop-cg-track" data-change-action="cgTrack" data-cg-context="improvement"
		       data-cg-group="fortifications" data-cg-option="palisade" data-cg-index="1" checked>
		<button class="stonetop-item-resource-check is-checked" data-move-slug="trade" data-index="0"></button>`;
	await sheet._onFirstRender({}, {});
	sheet._onRender({}, {});
	return { sheet, steading };
}

describe("StonetopSteadingSheet — V2 control bindings (one per tab)", () => {
	it("routes overview, residents, neighbors, and notes controls to their setters", async () => {
		const { sheet, steading } = await renderSheet();
		const el = sel => sheet.element.querySelector(sel);

		fire(el(".steading-box-input[name='stonetop-fortunes']"), "change");
		expect(steading.setFortunes).toHaveBeenCalledWith(2);

		fire(el(".stonetop-resident-name"), "change");
		expect(steading.updateResidentName).toHaveBeenCalledWith("r1", "Cerdig");

		fire(el(".stonetop-neighbor-person-name"), "change");
		expect(steading.updateNeighborName).toHaveBeenCalledWith("n1", "Marock");

		fire(el(".stonetop-notes"), "change");
		expect(steading.setNotes).toHaveBeenCalledWith("a note");
	});

	it("routes the steadfast combobox to renameOrApplySteadfast with the stashed list", async () => {
		const { sheet, steading } = await renderSheet();
		sheet._availableSteadfasts = [{ slug: "barrier-pass", name: "Barrier Pass" }];
		fire(sheet.element.querySelector(".steading-steadfast-input"), "change");
		expect(steading.renameOrApplySteadfast).toHaveBeenCalledWith(
			"Barrier Pass", [{ slug: "barrier-pass", name: "Barrier Pass" }]);
	});

	it("routes the traits-source textarea to Residents.updateTraitsSource (raw text)", async () => {
		const { sheet, steading } = await renderSheet();
		fire(sheet.element.querySelector(".steading-npc-traits-source"), "change");
		expect(steading.updateResidentTraitsSource).toHaveBeenCalledWith("gruff\ncurious");
	});

	it("routes the delegated improvement track and move-resource pip", async () => {
		const { sheet, steading } = await renderSheet();

		fire(sheet.element.querySelector(".stonetop-cg-track"), "change");
		// A ChoiceTarget, not raw dataset strings: the steading's own store routes on its context.
		const [target, index, checked] = steading.setChoiceTrackFor.mock.calls[0];
		expect(target.context).toBe("improvement");
		expect(target.group).toBe("fortifications");
		expect(target.option).toBe("palisade");
		expect([index, checked]).toEqual(["1", true]);

		fire(sheet.element.querySelector(".stonetop-item-resource-check"), "click");
		expect(steading.toggleMoveResourcePip).toHaveBeenCalledWith("trade", "0", true);
	});

	it("ignores events while the sheet is not editable, then honors them once it becomes editable", async () => {
		// The delegated listeners wire once (first render) but check editability per event —
		// a sheet that gains ownership mid-session must not need re-instantiation.
		const { sheet, steading } = await renderSheet({ editable: false });
		fire(sheet.element.querySelector(".stonetop-cg-track"), "change");
		expect(steading.setChoiceTrackFor).not.toHaveBeenCalled();

		sheet.isEditable = true;
		fire(sheet.element.querySelector(".stonetop-cg-track"), "change");
		expect(steading.setChoiceTrackFor).toHaveBeenCalledTimes(1);
	});

	it("binds no direct controls when the sheet is not editable", async () => {
		const { sheet, steading } = await renderSheet({ editable: false });
		fire(sheet.element.querySelector(".stonetop-notes"), "change");
		expect(steading.setNotes).not.toHaveBeenCalled();
	});
});
