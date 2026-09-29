// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createStonetopCharacterSheetClass } from "../../../src/actors/character/StonetopCharacterSheet.js";
import { StonetopCharacter } from "../../../src/actors/character/StonetopCharacter.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { FakeRepositoryFactory } from "../../fakes/FakeRepositoryFactory.js";
import { FakeGameBuilder } from "../../fakes/FakeGameBuilder.js";
import { renderTemplate } from "../../fakes/renderTemplate.js";
import { OpenDisclosures } from "../../../src/utils/OpenDisclosures.js";
import { BarGrain } from "../../../src/utils/BarGrain.js";

// The rail's reference moves, end to end: seeded move items, through CharacterMoves and the real
// snapshot, into the real sheet template, pressed through the sheet's own actions.
//
// D8: the basic moves stay in view, a group that starts open; the expedition moves are a second group,
// shut by default and split by phase; follower moves go to the top of the Followers tab, once, and only
// while there are followers.

const seeded = (slug, name, categoryKey, system = {}) => ({
	_id: `m-${slug}`, type: "move", name,
	system: { slug, categoryKey, moveType: categoryKey, acquired: true, instanceCount: 1, description: "", ...system },
});

const MOVES = [
	seeded("defy-danger", "Defy Danger", "basic", { rollStat: "ask", description: "When you **_act despite a threat_**, roll." }),
	seeded("defend", "Defend", "basic", { rollStat: "con", resource: { max: 4 } }),
	seeded("return-triumphant", "Return Triumphant", "expedition", { phase: "getting-home" }),
	seeded("forage", "Forage", "expedition", { rollStat: "wis", phase: "on-the-road" }),
	seeded("outfit", "Outfit", "expedition", { phase: "setting-out" }),
	seeded("deaths-door", "Death's Door", "special", { rollStat: "prompt" }),
	seeded("order-followers", "Order Followers", "follower"),
];

const follower = () => ({
	_id: "crew-item", type: "follower", name: "Crew",
	system: { slug: "crew", owned: true, showOnTab: true, inventory: { checked: {} } },
});

function makeSheet({ followers = [] } = {}) {
	new FakeGameBuilder().build();
	const repos = new FakeRepositoryFactory();
	const actor = new FakeCharacterActorBuilder()
		.withItems([...MOVES, ...followers])
		.withTypedActor(a => new StonetopCharacter(a, repos))
		.build();
	const Base = class {
		tabGroups = {};
		element = document.createElement("form");
		openDisclosures = new OpenDisclosures();
		render = vi.fn();
		changeTab = vi.fn();
		get actor() { return actor; }
		get typedActor() { return actor.typedActor; }
		get isEditable() { return true; }
		_getTabsConfig(group) { return this.constructor.TABS[group] ?? null; }
		async _prepareContext() {
			return { tabs: {}, actor, editable: true, sheetIdPrefix: "sheet", stonetop: await actor.typedActor.buildSnapshot() };
		}
		async _onFirstRender() {}
		_onRender() {}
	};
	return { sheet: new (createStonetopCharacterSheetClass(Base))() };
}

// A render, then the sheet putting back what its reader opened — what a re-render does in play.
async function render(sheet) {
	const context = await sheet._prepareContext({});
	sheet.element.innerHTML = renderTemplate("systems/stonetop/templates/actor/character.hbs", context);
	sheet.openDisclosures.restore(sheet.element);
	document.body.replaceChildren(sheet.element);
	return sheet.element;
}

const rail = root => root.querySelector(".stonetop-rail");
const panel = (root, title) => [...rail(root).querySelectorAll(".stonetop-panel")]
	.find(p => p.querySelector(".stonetop-bar-title")?.textContent === title);
const slugsIn = el => [...el.querySelectorAll("li.stonetop-mrow")].map(li => li.dataset.slug);
const press = (sheet, target) => sheet.constructor.DEFAULT_OPTIONS.actions[target.dataset.action]
	.call(sheet, new Event("click"), target);

beforeEach(() => { document.body.innerHTML = ""; });

describe("the rail's move groups (integration)", () => {
	it("keeps the basic moves in view, in a group that starts open", async () => {
		const root = await render(makeSheet().sheet);
		const basic = panel(root, "stonetop.character.moves.basicMoves");
		expect(basic.querySelector(".stonetop-bar-toggle").getAttribute("aria-expanded")).toBe("true");
		expect(basic.querySelector(".stonetop-panel-body").hidden).toBe(false);
		expect(slugsIn(basic)).toEqual(["defy-danger", "defend"]);
	});

	it("shuts the expedition moves by default, split by the part of the journey each is for", async () => {
		const root = await render(makeSheet().sheet);
		const expedition = panel(root, "stonetop.character.moves.expeditionMoves");
		expect(expedition.querySelector(".stonetop-bar-toggle").getAttribute("aria-expanded")).toBe("false");
		expect(expedition.querySelector(".stonetop-panel-body").hidden).toBe(true);
		expect(slugsIn(expedition)).toEqual(["outfit", "forage", "return-triumphant"]);
		expect(expedition.querySelectorAll(".stonetop-move-phase-title")).toHaveLength(3);
	});

	it("opens a group from its bar, and keeps it open across a redraw", async () => {
		const { sheet } = makeSheet();
		let root = await render(sheet);
		press(sheet, panel(root, "stonetop.character.moves.expeditionMoves").querySelector(".stonetop-bar-toggle"));
		root = await render(sheet);
		const expedition = panel(root, "stonetop.character.moves.expeditionMoves");
		expect(expedition.querySelector(".stonetop-panel-body").hidden).toBe(false);
		expect(expedition.querySelector(".stonetop-bar-toggle").getAttribute("aria-expanded")).toBe("true");
	});

	it("opens a move's text from its caret, and keeps it open across a redraw", async () => {
		const { sheet } = makeSheet();
		let root = await render(sheet);
		press(sheet, rail(root).querySelector('li[data-slug="defy-danger"] .stonetop-mrow-caret'));
		root = await render(sheet);
		const row = rail(root).querySelector('li[data-slug="defy-danger"]');
		expect(row.querySelector(".stonetop-move-body").hidden).toBe(false);
		expect(row.querySelector(".stonetop-move-gloss").hidden).toBe(true);
	});

	it("rolls from the name, and carries no chat button in the rail", async () => {
		const root = await render(makeSheet().sheet);
		const row = rail(root).querySelector('li[data-slug="defend"]');
		expect(row.querySelector("button.rollable").dataset.roll).toBe("con");
		expect(rail(root).querySelector(".stonetop-move-chat")).toBeNull();
	});

	it("keeps Defend's track on its row", async () => {
		const root = await render(makeSheet().sheet);
		expect(rail(root).querySelectorAll('li[data-slug="defend"] .stonetop-item-resource-check')).toHaveLength(4);
	});

	it("alternates the rail's bar textures in its own drawing order", async () => {
		const root = await render(makeSheet().sheet);
		const bars = [...rail(root).querySelectorAll(".stonetop-bar")];
		expect(bars[0].className).toBe(`stonetop-bar ${BarGrain.of(bars[0].textContent.trim(), 0).classes}`.trim());
		expect(bars[1].classList.contains("stonetop-bar--heavy")).toBe(true);
	});

	it("takes the follower moves out of the rail", async () => {
		const root = await render(makeSheet({ followers: [follower()] }).sheet);
		expect(slugsIn(rail(root))).not.toContain("order-followers");
	});
});

describe("the follower moves (integration)", () => {
	const followersTab = root => root.querySelector('.tab[data-tab="followers"]');

	it("sit at the top of the Followers tab, once, while there are followers", async () => {
		const root = await render(makeSheet({ followers: [follower()] }).sheet);
		const first = followersTab(root).querySelector(".stonetop-panel");
		expect(first.querySelector(".stonetop-bar-title").textContent).toBe("stonetop.character.moves.followerMoves");
		expect(slugsIn(followersTab(root))).toEqual(["order-followers"]);
		expect(first.querySelector(".stonetop-move-chat")).not.toBeNull();
	});

	it("are absent while there is nobody to order", async () => {
		const root = await render(makeSheet().sheet);
		expect(slugsIn(followersTab(root))).toEqual([]);
	});
});
