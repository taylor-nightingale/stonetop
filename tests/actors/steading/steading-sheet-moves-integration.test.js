import { describe, it, expect } from "vitest";
import { createStonetopSteadingSheetClass } from "../../../src/actors/steading/StonetopSteadingSheet.js";
import { StonetopSteading } from "../../../src/actors/steading/StonetopSteading.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";
import { FakeMoveRepository } from "../../fakes/FakeMoveRepository.js";
import { FakeCompendiumMoveBuilder } from "../../fakes/FakeCompendiumMoveBuilder.js";

// End-to-end for the homefront-move wiring: real StonetopSteading + SteadingMoves + ResourceController
// behind the sheet's own activateListeners. Only the jQuery/DOM boundary is faked — a collector that
// records the handlers the sheet registers so we can fire synthetic events and assert the actor state
// the standard move flow produces (toggle the owned move, persist resource count + text).

// A stand-in for the jQuery `html` object + its root element. `find(sel).on(evt, fn)` and
// `html[0].addEventListener(evt, fn)` record handlers; the helpers below replay them.
function makeHtml() {
	const direct = new Map();     // `${selector}|${event}` → [handlers]
	const delegated = [];         // { event, handler } registered on the root element
	const root = { addEventListener: (event, handler) => delegated.push({ event, handler }) };
	const html = {
		0: root,
		find(selector) {
			const chain = {
				on(event, handler) {
					const key = `${selector}|${event}`;
					if (!direct.has(key)) direct.set(key, []);
					direct.get(key).push(handler);
					return chain;
				},
			};
			return chain;
		},
	};
	return {
		html,
		fireDirect: (selector, event, ev) => Promise.all((direct.get(`${selector}|${event}`) ?? []).map(h => h(ev))),
		fireDelegated: (event, ev) => Promise.all(delegated.filter(d => d.event === event).map(d => d.handler(ev))),
	};
}

class FakeBase {
	constructor(actor) { this.actor = actor; this._actor = actor; }
	activateListeners() {}
}

async function makeWiredSheet() {
	const actor = new FakeSteadingBuilder().build();
	const repo = new FakeMoveRepository().addWorld(
		new FakeCompendiumMoveBuilder().withName("Trade").withMoveType("homefront")
			.withResource({ title: "Uses", labels: ["", "", ""] }).build()
	);
	actor.typedActor = new StonetopSteading(actor, { getBySlug: async () => null }, repo);
	await actor.typedActor.buildSnapshot();   // seeds the homefront move as an embedded item

	const Sheet = createStonetopSteadingSheetClass(FakeBase);
	const sheet = new Sheet(actor);
	sheet.isEditable = true;

	const { html, fireDirect, fireDelegated } = makeHtml();
	sheet.activateListeners(html);
	return { actor, sheet, fireDirect, fireDelegated };
}

const homefrontItem = actor => [...actor.items].find(i => i.system?.categoryKey === "homefront");

describe("StonetopSteadingSheet homefront-move wiring (integration)", () => {
	it("unchecking the move check toggles the owned move off", async () => {
		const { actor, fireDirect } = await makeWiredSheet();
		await fireDirect(".stonetop-move-check", "change", { currentTarget: { dataset: { moveSlug: "trade" }, checked: false } });
		expect(homefrontItem(actor).system.instanceCount).toBe(0);
		expect(homefrontItem(actor).system.acquired).toBe(false);
	});

	it("clicking an unchecked resource pip persists the new current count", async () => {
		const { actor, fireDelegated } = await makeWiredSheet();
		const btn = { dataset: { moveSlug: "trade", index: "0" }, classList: { contains: () => false } };
		await fireDelegated("click", {
			target: { closest: sel => (sel === ".stonetop-item-resource-check" ? btn : null) },
			stopPropagation() {}, stopImmediatePropagation() {},
		});
		expect(actor.system.resources.counts.moves.trade).toBe(1);
	});

	it("editing the resource fill-in input persists its text under the move slug", async () => {
		const { actor, fireDelegated } = await makeWiredSheet();
		const input = { dataset: { moveSlug: "trade" }, value: "grain" };
		await fireDelegated("change", {
			target: { closest: sel => (sel === ".stonetop-resource-input" ? input : null) },
		});
		expect(actor.system.resources.texts.moves.trade).toBe("grain");
	});
});
