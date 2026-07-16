// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { createStonetopSteadingSheetClass } from "../../../src/actors/steading/StonetopSteadingSheet.js";

// Routes native DOM events to the matching typed-steading method — one representative control per
// tab, plus the delegated (improvement track / move resource) listeners. Mirrors the NPC sheet's
// _onRender binding tests: the real controllers are exercised elsewhere, so a spy typed steading is
// enough to prove the V2 lifecycle wires each control to the right call. Tab navigation is core's
// built-in `tab` action (data-action="tab" in the template) — no sheet wiring to test here.
const fire = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));

function makeSpySteading() {
	return {
		setFortunes: vi.fn(), setSurplus: vi.fn(), setRollMode: vi.fn(), setNotes: vi.fn(),
		renameOrApplySteadfast: vi.fn(),
		attributes:  { setValue: vi.fn(), addNewItemToAttribute: vi.fn(), removeItemFromAttribute: vi.fn(), updateItemOnAttribute: vi.fn() },
		debilities:  { setDebility: vi.fn() },
		content:     { updateText: vi.fn() },
		assets:      { addItem: vi.fn(), removeItem: vi.fn(), updateItem: vi.fn(), updatePurses: vi.fn(), updateHandfuls: vi.fn(), updateCoins: vi.fn() },
		residents:   { add: vi.fn(), remove: vi.fn(), updateName: vi.fn(), updateOccupation: vi.fn(), updateTraits: vi.fn(), updateTraitsSource: vi.fn() },
		neighborPeople: { add: vi.fn(), remove: vi.fn(), updateName: vi.fn(), updateOccupation: vi.fn(), updateTraits: vi.fn(), updateHome: vi.fn() },
		neighborPlaces: { updateNote: vi.fn() },
		placesOfInterest: { addBlankPlace: vi.fn(), setPlaceValue: vi.fn() },
		improvements: { toggleTrack: vi.fn() },
		moves:       { incrementMove: vi.fn(), decrementMove: vi.fn(), toggleResourcePip: vi.fn(), setMoveResourceText: vi.fn() },
	};
}

async function renderSheet({ editable = true } = {}) {
	const steading = makeSpySteading();
	const actor = { typedActor: steading, name: "Stonetop" };
	const Base = class {
		get actor() { return actor; }
		tabGroups = {};
		element = document.createElement("form");
		async _onFirstRender() {}
		_onRender() {}
	};
	const sheet = new (createStonetopSteadingSheetClass(Base))(actor);
	sheet.isEditable = editable;
	sheet.element.innerHTML = `
		<input class="steading-steadfast-input" value="Barrier Pass">
		<input class="steading-box-input" name="stonetop-fortunes" value="2">
		<input class="stonetop-resident-name" data-id="r1" value="Cerdig">
		<input class="stonetop-neighbor-person-name" data-id="n1" value="Marock">
		<textarea class="steading-npc-traits-source">gruff
curious</textarea>
		<textarea class="stonetop-notes">a note</textarea>
		<input type="checkbox" class="stonetop-cg-track" data-cg-context="improvement"
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
		expect(steading.residents.updateName).toHaveBeenCalledWith("r1", "Cerdig");

		fire(el(".stonetop-neighbor-person-name"), "change");
		expect(steading.neighborPeople.updateName).toHaveBeenCalledWith("n1", "Marock");

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
		expect(steading.residents.updateTraitsSource).toHaveBeenCalledWith("gruff\ncurious");
	});

	it("routes the delegated improvement track and move-resource pip", async () => {
		const { sheet, steading } = await renderSheet();

		fire(sheet.element.querySelector(".stonetop-cg-track"), "change");
		expect(steading.improvements.toggleTrack).toHaveBeenCalledWith("fortifications", "palisade", "1", true);

		fire(sheet.element.querySelector(".stonetop-item-resource-check"), "click");
		expect(steading.moves.toggleResourcePip).toHaveBeenCalledWith("trade", "0", true);
	});

	it("ignores events while the sheet is not editable, then honors them once it becomes editable", async () => {
		// The delegated listeners wire once (first render) but check editability per event —
		// a sheet that gains ownership mid-session must not need re-instantiation.
		const { sheet, steading } = await renderSheet({ editable: false });
		fire(sheet.element.querySelector(".stonetop-cg-track"), "change");
		expect(steading.improvements.toggleTrack).not.toHaveBeenCalled();

		sheet.isEditable = true;
		fire(sheet.element.querySelector(".stonetop-cg-track"), "change");
		expect(steading.improvements.toggleTrack).toHaveBeenCalledTimes(1);
	});

	it("binds no direct controls when the sheet is not editable", async () => {
		const { sheet, steading } = await renderSheet({ editable: false });
		fire(sheet.element.querySelector(".stonetop-notes"), "change");
		expect(steading.setNotes).not.toHaveBeenCalled();
	});
});
