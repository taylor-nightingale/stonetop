// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { createStonetopSteadingSheetClass } from "../../../src/actors/steading/StonetopSteadingSheet.js";
import { StonetopSteading } from "../../../src/actors/steading/StonetopSteading.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";
import { FakeMoveRepository } from "../../fakes/FakeMoveRepository.js";
import { FakeCompendiumMoveBuilder } from "../../fakes/FakeCompendiumMoveBuilder.js";

// End-to-end for the homefront-move wiring: real StonetopSteading + SteadingMoves + ResourceController
// behind the sheet's own V2 lifecycle. The move-check is a per-render direct binding (_onRender); the
// resource pips/fill-in are delegated capture listeners wired once on the persistent root
// (_onFirstRender). We render real DOM controls, run both lifecycle hooks, then fire native events and
// assert the actor state the standard move flow produces.
const fire = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));

async function makeWiredSheet() {
	const actor = new FakeSteadingBuilder().build();
	const repo = new FakeMoveRepository().addBasic(
		new FakeCompendiumMoveBuilder().withName("Trade").withMoveType("homefront")
			.withResource({ title: "Uses", labels: ["", "", ""] }).build()
	);
	actor.typedActor = new StonetopSteading(actor, { getBySlug: async () => null }, repo);
	await actor.typedActor.moves.seedHomefrontMoves();   // create-time seed (no longer on render)

	const Base = class {
		get actor() { return actor; }
		get isEditable() { return true; }
		tabGroups = {};
		element = document.createElement("form");
		async _onFirstRender() {}
		_onRender() {}
		render = vi.fn();
	};
	const sheet = new (createStonetopSteadingSheetClass(Base))(actor);
	sheet.element.innerHTML = `
		<input type="checkbox" class="stonetop-move-check" data-move-slug="trade" checked>
		<button class="stonetop-item-resource-check" data-move-slug="trade" data-index="0"></button>
		<input class="stonetop-resource-input" data-move-slug="trade" value="grain">`;
	await sheet._onFirstRender({}, {});   // delegated resource listeners on the root
	sheet._onRender({}, {});              // direct move-check binding
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
		fire(sheet.element.querySelector(".stonetop-item-resource-check"), "click");
		await Promise.resolve();
		expect(actor.system.resources.counts.moves.trade).toBe(1);
	});

	it("editing the resource fill-in input persists its text under the move slug", async () => {
		const { actor, sheet } = await makeWiredSheet();
		fire(sheet.element.querySelector(".stonetop-resource-input"), "change");
		await Promise.resolve();
		expect(actor.system.resources.texts.moves.trade).toBe("grain");
	});
});
