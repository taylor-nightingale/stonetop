// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import { createStonetopSteadingSheetClass } from "../../../src/actors/steading/StonetopSteadingSheet.js";
import { stonetopActorSheetBase } from "../../fakes/foundry/stonetopActorSheetBase.js";

const template = readFileSync("templates/actor/steading.hbs", "utf8");
const actions  = createStonetopSteadingSheetClass(stonetopActorSheetBase()).DEFAULT_OPTIONS.actions;

function stubFoundry() {
	const confirm = vi.fn(async () => true);
	vi.stubGlobal("foundry", { applications: { api: { DialogV2: { confirm } } } });
	vi.stubGlobal("ui", { notifications: { info: vi.fn() } });
	vi.stubGlobal("game", { i18n: { localize: k => k, format: (k, d) => `${k}:${JSON.stringify(d)}` } });
}

function spySteading() {
	return {
		previewResidentActors:       vi.fn(async () => [{ willCreate: true, willLink: false, name: "Willa" }]),
		previewNeighborActors:       vi.fn(async () => [{ willCreate: true, willLink: false, name: "Brennan" }]),
		createMissingResidentActors: vi.fn(async () => {}),
		createMissingNeighborActors: vi.fn(async () => {}),
	};
}

afterEach(() => vi.unstubAllGlobals());

describe("the roster's create-actors controls", () => {
	it("renders only for a GM — a player cannot create actors or folders at all", () => {
		expect(template).toMatch(/\{\{#if isGM\}\}[\s\S]*?data-action="createResidentActors"[\s\S]*?\{\{\/if\}\}/);
		expect(template).toMatch(/\{\{#if isGM\}\}[\s\S]*?data-action="createNeighborActors"[\s\S]*?\{\{\/if\}\}/);
	});

	it("uses buttons, so the control is reachable from the keyboard", () => {
		for (const action of ["createResidentActors", "createNeighborActors"]) {
			expect(template).toMatch(new RegExp(`<button[^>]*data-action="${action}"`));
		}
	});

	it("runs the residents pass through the steading's own named methods", async () => {
		stubFoundry();
		const steading = spySteading();
		await actions.createResidentActors.call({ isEditable: true, _stonetopSteading: steading });
		expect(steading.previewResidentActors).toHaveBeenCalledOnce();
		expect(steading.createMissingResidentActors).toHaveBeenCalledOnce();
	});

	it("runs the neighbours pass through theirs", async () => {
		stubFoundry();
		const steading = spySteading();
		await actions.createNeighborActors.call({ isEditable: true, _stonetopSteading: steading });
		expect(steading.previewNeighborActors).toHaveBeenCalledOnce();
		expect(steading.createMissingNeighborActors).toHaveBeenCalledOnce();
	});

	it("does nothing on a non-editable sheet", async () => {
		stubFoundry();
		const steading = spySteading();
		await actions.createResidentActors.call({ isEditable: false, _stonetopSteading: steading });
		expect(steading.previewResidentActors).not.toHaveBeenCalled();
	});
});
