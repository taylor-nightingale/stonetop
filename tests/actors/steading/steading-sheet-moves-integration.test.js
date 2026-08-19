// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { createStonetopSteadingSheetClass } from "../../../src/actors/steading/StonetopSteadingSheet.js";
import { StonetopSteading } from "../../../src/actors/steading/StonetopSteading.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";
import { FakeMoveRepository } from "../../fakes/FakeMoveRepository.js";
import { FakeCompendiumMoveBuilder } from "../../fakes/FakeCompendiumMoveBuilder.js";
import { stonetopActorSheetBase } from "../../fakes/foundry/stonetopActorSheetBase.js";
import { fire } from "../../fakes/domEvents.js";
import { steadingRepos } from "../../fakes/FakeSteadingRepos.js";

// End-to-end for the homefront-move wiring: real StonetopSteading + SteadingMoves + ResourceController
// behind the sheet's own V2 lifecycle. The move-check is a per-render direct binding (_onRender); the
// resource pips/fill-in are delegated capture listeners wired once on the persistent root
// (_onFirstRender). We render real DOM controls, run both lifecycle hooks, then fire native events and
// assert the actor state the standard move flow produces.

async function makeWiredSheet() {
	const actor = new FakeSteadingBuilder().build();
	const repo = new FakeMoveRepository().addBasic(
		new FakeCompendiumMoveBuilder().withName("Trade").withMoveType("homefront")
			.withResource({ title: "Uses", labels: ["", "", ""] }).build()
	);
	actor.typedActor = new StonetopSteading(actor, steadingRepos({ improvements: { getBySlug: async () => null }, moves: repo }));
	await actor.typedActor.onCreate();   // create-time seed (no longer on render)

	const sheet = new (createStonetopSteadingSheetClass(stonetopActorSheetBase()))(actor);
	// Mirrors what move-item.hbs / resource-input.hbs stamp — the action names are the contract
	// between the shared partial and the sheet's handler maps.
	sheet.element.innerHTML = `
		<input type="checkbox" class="stonetop-move-check" data-change-action="moveCheck"
		       data-category-key="homefront" data-move-slug="trade" checked>
		<button class="stonetop-item-resource-check" data-action="moveResourcePip"
		        data-move-slug="trade" data-index="0"></button>
		<input class="stonetop-resource-input" data-change-action="moveResourceText"
		       data-move-slug="trade" value="grain">`;
	await sheet._onFirstRender({}, {});   // delegated routers on the persistent root
	sheet._onRender({}, {});
	return { actor, sheet };
}

const homefrontItem = actor => [...actor.items].find(i => i.system?.categoryKey === "homefront");

describe("StonetopSteadingSheet homefront-move wiring (integration)", () => {
	it("unchecking the move check toggles the owned move off", async () => {
		const { actor, sheet } = await makeWiredSheet();
		const check = sheet.element.querySelector(".stonetop-move-check");
		check.checked = false;
		fire(check, "change");
		await Promise.resolve();
		expect(homefrontItem(actor).system.instanceCount).toBe(0);
		expect(homefrontItem(actor).system.acquired).toBe(false);
	});

	it("clicking an unchecked resource pip persists the new current count", async () => {
		const { actor, sheet } = await makeWiredSheet();
		const pip = sheet.element.querySelector(".stonetop-item-resource-check");
		await sheet.constructor.DEFAULT_OPTIONS.actions.moveResourcePip
			.call(sheet, { type: "click", button: 0 }, pip);
		await Promise.resolve();
		expect(actor.system.resources.counts.moves.trade).toBe(1);
	});

	it("editing the resource fill-in input persists its text under the move slug", async () => {
		const { actor, sheet } = await makeWiredSheet();
		fire(sheet.element.querySelector(".stonetop-resource-input"), "change");
		await Promise.resolve();
		expect(actor.system.resources.texts.moves.trade).toBe("grain");
	});

	// The steading now renders more than one category, so the checkbox's category is load-bearing:
	// the handler routes the toggle by it, and a move-item that stopped stamping it would toggle
	// nothing. Nothing renders .hbs here, so assert the template still emits what the handler reads.
	it("reads the category the move-item template stamps on the check", () => {
		const template = readFileSync(path.resolve(process.cwd(), "templates/actor/partials/move-item.hbs"), "utf8");
		expect(template).toContain('data-category-key="{{categoryKey}}"');
		expect(readFileSync(path.resolve(process.cwd(), "src/actors/moveRowHandlers.js"), "utf8"))
			.toContain("el.dataset.categoryKey");
	});

	it("the moveToChat action hands the seeded homefront move to the actor's chat surface", async () => {
		const { actor, sheet } = await makeWiredSheet();
		const btn = document.createElement("a");
		btn.dataset.moveSlug = "trade";
		// Invoke the data-action handler the way core does: handler.call(app, event, target).
		await sheet.constructor.DEFAULT_OPTIONS.actions.moveToChat.call(sheet, { type: "click" }, btn);
		expect(actor.chatItems).toHaveLength(1);
		expect(actor.chatItems[0].name).toBe("Trade");
	});
});
