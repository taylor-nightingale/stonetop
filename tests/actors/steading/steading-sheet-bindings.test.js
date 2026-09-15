// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { createStonetopSteadingSheetClass } from "../../../src/actors/steading/StonetopSteadingSheet.js";
import { stonetopActorSheetBase } from "../../fakes/foundry/stonetopActorSheetBase.js";
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
	"setDebility", "addContentItem", "removeContentItem", "updateContentItem",
	"addAssetItem", "removeAssetItem", "updateAssetItem", "setAssetRequisitioned",
	"updateCoinagePurses", "updateCoinageHandfuls", "updateCoinageCoins",
	"addPerson", "addPersonNamed", "removePerson", "updatePersonName", "updatePersonOccupation",
	"updatePersonTraits", "updatePersonHome", "appendPersonTrait", "updateFolkTraitsSource",
	"unlinkPerson", "linkPerson",
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
	const sheet = new (createStonetopSteadingSheetClass(stonetopActorSheetBase()))(actor);
	sheet.isEditable = editable;
	sheet.element.innerHTML = `
		<input class="steading-steadfast-input" data-change-action="steadfastName" value="Barrier Pass">
		<input type="number" class="stonetop-step steading-attr-input" data-change-action="fortunes" data-attr="fortunes" value="2">
		<input type="number" class="stonetop-step steading-attr-input" data-change-action="attribute" data-attr="defenses" value="3">
		<div class="steading-folk-roster"><div class="steading-folk-row" data-id="r1">
			<input class="stonetop-person-name" data-change-action="personName" data-id="r1" value="Cerdig">
			<input class="stonetop-person-home" data-change-action="personHome" data-id="r1" value="Marshedge">
		</div></div>
		<input type="checkbox" class="stonetop-item-check" data-change-action="assetRequisitioned" data-index="1" checked>
		<textarea class="stonetop-notes" data-change-action="notes">a note</textarea>
		<input type="checkbox" class="stonetop-cg-track" data-change-action="cgTrack" data-cg-context="improvement"
		       data-cg-group="fortifications" data-cg-option="palisade" data-cg-index="1" checked>
		<button class="stonetop-item-resource-check is-checked" data-action="moveResourcePip"
		        data-move-slug="trade" data-index="0"></button>`;
	await sheet._onFirstRender({}, {});
	sheet._onRender({}, {});
	return { sheet, steading };
}

describe("StonetopSteadingSheet — V2 control bindings (one per tab)", () => {
	it("routes overview, roster and notes controls to their setters", async () => {
		const { sheet, steading } = await renderSheet();
		const el = sel => sheet.element.querySelector(sel);

		fire(el(".steading-attr-input[data-attr='fortunes']"), "change");
		expect(steading.setFortunes).toHaveBeenCalledWith(2);

		fire(el(".steading-attr-input[data-attr='defenses']"), "change");
		expect(steading.setAttribute).toHaveBeenCalledWith("defenses", 3);

		fire(el(".stonetop-person-name"), "change");
		expect(steading.updatePersonName).toHaveBeenCalledWith("r1", "Cerdig");

		fire(el(".stonetop-person-home"), "change");
		expect(steading.updatePersonHome).toHaveBeenCalledWith("r1", "Marshedge");

		fire(el("[data-change-action='assetRequisitioned']"), "change");
		expect(steading.setAssetRequisitioned).toHaveBeenCalledWith(1, true);

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

	it("routes the delegated improvement track and move-resource pip", async () => {
		const { sheet, steading } = await renderSheet();

		fire(sheet.element.querySelector(".stonetop-cg-track"), "change");
		// A ChoiceTarget, not raw dataset strings: the steading's own store routes on its context.
		const [target, index, checked] = steading.setChoiceTrackFor.mock.calls[0];
		expect(target.context).toBe("improvement");
		expect(target.group).toBe("fortifications");
		expect(target.option).toBe("palisade");
		expect([index, checked]).toEqual(["1", true]);

		// The pip is a data-action now, dispatched by core's actions pipeline.
		const pip = sheet.element.querySelector(".stonetop-item-resource-check");
		await sheet.constructor.DEFAULT_OPTIONS.actions.moveResourcePip
			.call(sheet, { type: "click", button: 0 }, pip);
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
