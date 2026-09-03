// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import { createStonetopSteadingSheetClass } from "../../../src/actors/steading/StonetopSteadingSheet.js";
import { stonetopActorSheetBase } from "../../fakes/foundry/stonetopActorSheetBase.js";

const template = readFileSync("templates/actor/partials/steading-folk-roster.hbs", "utf8");
const actions  = createStonetopSteadingSheetClass(stonetopActorSheetBase()).DEFAULT_OPTIONS.actions;

function stubFoundry() {
	const confirm = vi.fn(async () => true);
	vi.stubGlobal("foundry", { applications: { api: { DialogV2: { confirm } } } });
	vi.stubGlobal("ui", { notifications: { info: vi.fn() } });
	vi.stubGlobal("game", { i18n: { localize: k => k, format: (k, d) => `${k}:${JSON.stringify(d)}` } });
}

function spySteading() {
	return {
		previewFolkActors:       vi.fn(async () => [{ willCreate: true, willLink: false, name: "Willa" }]),
		createMissingFolkActors: vi.fn(async () => {}),
	};
}

afterEach(() => vi.unstubAllGlobals());

describe("the roster's create-actors controls", () => {
	it("renders only for a GM — a player cannot create actors or folders at all", () => {
		expect(template).toMatch(/\{\{#if isGM\}\}[\s\S]*?data-action="createFolkActors"[\s\S]*?\{\{\/if\}\}/);
	});

	it("uses a button, so the control is reachable from the keyboard", () => {
		expect(template).toMatch(/<button[^>]*data-action="createFolkActors"/);
	});

	// One roster, so one pass — there is no second list to catch up separately.
	it("runs the roster's pass through the steading's own named methods", async () => {
		stubFoundry();
		const steading = spySteading();
		await actions.createFolkActors.call({ isEditable: true, _stonetopSteading: steading });
		expect(steading.previewFolkActors).toHaveBeenCalledOnce();
		expect(steading.createMissingFolkActors).toHaveBeenCalledOnce();
	});

	it("does nothing on a non-editable sheet", async () => {
		stubFoundry();
		const steading = spySteading();
		await actions.createFolkActors.call({ isEditable: false, _stonetopSteading: steading });
		expect(steading.previewFolkActors).not.toHaveBeenCalled();
	});
});
