// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStonetopActorClass } from "../../../src/actors/StonetopActor.js";
import { ActorRolling } from "../../../src/actors/ActorRolling.js";
import { RollModeDialog } from "../../../src/actors/RollModeDialog.js";
import { StonetopCharacter } from "../../../src/actors/character/StonetopCharacter.js";
import { FakeCharacterActorBuilder, FakeStatBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { FakeRepositoryFactory } from "../../fakes/FakeRepositoryFactory.js";
import { FakeRoll } from "../../fakes/foundry/FakeRoll.js";
import { FakeChatMessage } from "../../fakes/foundry/FakeChatMessage.js";
import { fakeI18n } from "../../fakes/foundry/FakeI18n.js";
import { renderTemplate } from "../../fakes/renderTemplate.js";

// End-to-end: a click on a stat's die on a real character, the real RollModeDialog and its template,
// the mode picked in it, and the dice that roll. Only Foundry is faked — DialogV2.wait (which draws
// the dialog the way DialogV2 does and clicks what the test asks), Roll and ChatMessage.

let shown;   // the dialog config DialogV2 was handed, or null if nothing asked
let clickOn; // the action the "user" clicks, or null to dismiss

function drawAndClick(config) {
	shown = config;
	if (!clickOn) return null;
	const root = document.createElement("dialog");
	const buttons = config.buttons.map(b => `<button type="${b.type}" data-action="${b.action}">${b.label}</button>`);
	root.innerHTML = `<form>${config.content}<footer class="form-footer">${buttons.join("")}</footer></form>`;
	const button = config.buttons.find(b => b.action === clickOn);
	return button.callback(new Event("click"), root.querySelector(`[data-action="${clickOn}"]`), {});
}

function makeCharacter() {
	const Actor = createStonetopActorClass(class {});
	const actor = Object.assign(new Actor(), new FakeCharacterActorBuilder().withStats(new FakeStatBuilder().withInt(2)).build());
	actor.getRollData = () => ({});
	actor._typedActor = new StonetopCharacter(actor, new FakeRepositoryFactory());
	actor.__rolling = new ActorRolling(actor, new RollModeDialog({
		wait: async config => drawAndClick(config),
		render: async (path, context) => renderTemplate(path, context),
	}));
	return actor;
}

const statDie = (stat, { shiftKey = false } = {}) => {
	const die = { dataset: { roll: stat } };
	return { shiftKey, target: { closest: sel => (sel === "[data-roll]" ? die : null) } };
};

beforeEach(() => {
	shown = null;
	clickOn = null;
	FakeRoll.reset();
	FakeChatMessage.reset();
	vi.stubGlobal("Roll", FakeRoll);
	vi.stubGlobal("ChatMessage", FakeChatMessage);
	vi.stubGlobal("game", { i18n: fakeI18n() });
});

afterEach(() => vi.unstubAllGlobals());

describe("rolling a stat through the roll dialog (integration)", () => {
	it("asks, and rolls at the mode picked", async () => {
		clickOn = "adv";
		await makeCharacter()._onRoll(statDie("int"));
		expect(shown.content).toContain('<span class="stonetop-roll-prompt-formula">2d6 + 2</span>');
		expect(FakeRoll.lastInstance.formula).toBe("3d6kh2 + 2");
		expect(FakeChatMessage.lastCreated).not.toBeNull();
	});

	it("rolls nothing when the dialog is dismissed", async () => {
		await makeCharacter()._onRoll(statDie("int"));
		expect(shown).not.toBeNull();
		expect(FakeRoll.lastInstance).toBeNull();
		expect(FakeChatMessage.lastCreated).toBeNull();
	});

	it("rolls Normal straight away on a shift-click", async () => {
		await makeCharacter()._onRoll(statDie("int", { shiftKey: true }));
		expect(shown).toBeNull();
		expect(FakeRoll.lastInstance.formula).toBe("2d6 + 2");
	});
});
