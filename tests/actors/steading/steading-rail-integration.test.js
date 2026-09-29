// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { createStonetopSteadingSheetClass } from "../../../src/actors/steading/StonetopSteadingSheet.js";
import { StonetopSteading } from "../../../src/actors/steading/StonetopSteading.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";
import { FakeMoveRepository } from "../../fakes/FakeMoveRepository.js";
import { FakeCompendiumMoveBuilder } from "../../fakes/FakeCompendiumMoveBuilder.js";
import { stonetopActorSheetBase } from "../../fakes/foundry/stonetopActorSheetBase.js";
import { steadingRepos } from "../../fakes/FakeSteadingRepos.js";
import { renderTemplate } from "../../fakes/renderTemplate.js";
import { renderSheetPart } from "../../fakes/renderSheetPart.js";

// The steading's rail, end to end, as the character's now is: a tab on its edge that opens and shuts
// it, the two crowned ratings coming back to the ledger line while it is shut, and its move groups as
// panels whose bars open and shut them — remembered across the renders every edit causes. The rows
// inside stay the steading's own.

const STEADING_TEMPLATE = "systems/stonetop/templates/actor/steading.hbs";

async function makeSheet() {
	const actor = new FakeSteadingBuilder().build();
	const repo = new FakeMoveRepository()
		.addBasic(new FakeCompendiumMoveBuilder().withName("Bolster").withMoveType("homefront")
			.withDescription("When you **_prepare for what's coming_**, say how.").build());
	actor.typedActor = new StonetopSteading(actor, steadingRepos({ improvements: { getBySlug: async () => null }, moves: repo }));
	await actor.typedActor.onCreate();
	const sheet = new (createStonetopSteadingSheetClass(stonetopActorSheetBase()))(actor);
	sheet.id = "steading-1";
	document.body.append(sheet.element);
	return sheet;
}

const render = async sheet => renderSheetPart(sheet, renderTemplate(STEADING_TEMPLATE, await sheet._prepareContext({})));
const press = (sheet, target) => sheet.constructor.DEFAULT_OPTIONS.actions[target.dataset.action].call(sheet, { type: "click" }, target);
const panels = root => [...root.querySelectorAll(".steading-rail .stonetop-move-panel")];
const caretOf = panel => panel.querySelector(":scope > .stonetop-bar .stonetop-bar-toggle");
const bodyOf = panel => panel.querySelector(":scope > .stonetop-panel-body");

beforeEach(() => { document.body.innerHTML = ""; });

describe("the steading's rail (integration)", () => {
	it("has a tab on its edge and no folded strip", async () => {
		const root = await render(await makeSheet());
		const toggle = root.querySelector(".stonetop-rail-toggle");
		expect(toggle.dataset.action).toBe("toggleRail");
		expect(toggle.querySelector(".stonetop-rail-fold, .stonetop-rail-mark")).toBeNull();
		expect(root.querySelector(".stonetop-rail-layout").hasAttribute("data-side")).toBe(false);
	});

	it("shuts from its tab, and keeps Fortunes and Surplus on the ledger line to come back to", async () => {
		const sheet = await makeSheet();
		const root = await render(sheet);
		await press(sheet, root.querySelector(".stonetop-rail-toggle"));
		expect(root.querySelector(".stonetop-rail-layout").classList.contains("rail-shut")).toBe(true);
		expect(root.querySelectorAll(".steading-line .steading-railed").length).toBe(2);
	});

	// The column beside it is held still while it slides, and let go when the rail's slide ends.
	it("marks the layout moving while it slides from its tab, and clears the mark when the slide ends", async () => {
		const sheet = await makeSheet();
		const root = await render(sheet);
		const layout = root.querySelector(".stonetop-rail-layout");
		await press(sheet, root.querySelector(".stonetop-rail-toggle"));
		expect(layout.classList.contains("is-rail-moving")).toBe(true);
		const ended = new Event("transitionend");
		ended.propertyName = "margin-left";
		layout.querySelector(".stonetop-rail").dispatchEvent(ended);
		expect(layout.classList.contains("is-rail-moving")).toBe(false);
	});

	it("sets its move groups as panels with a bar each, the rows the steading's own", async () => {
		const root = await render(await makeSheet());
		const [homefront] = panels(root);
		expect(homefront).toBeDefined();
		expect(homefront.querySelector(".stonetop-bar-title").textContent).toBeTruthy();
		expect(caretOf(homefront).getAttribute("aria-expanded")).toBe("true");
		expect(homefront.querySelector('.stonetop-move-disclosure[data-move-slug="bolster"]')).not.toBeNull();
		expect(root.querySelector(".steading-rail .stonetop-move-group")).toBeNull();
	});

	it("shuts a group from its bar, and keeps it shut across a render", async () => {
		const sheet = await makeSheet();
		let root = await render(sheet);
		await press(sheet, caretOf(panels(root)[0]));
		root = await render(sheet);
		expect(bodyOf(panels(root)[0]).hidden).toBe(true);
		expect(caretOf(panels(root)[0]).getAttribute("aria-expanded")).toBe("false");
	});
});
