// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createStonetopCharacterSheetClass } from "../../../src/actors/character/StonetopCharacterSheet.js";
import { StonetopCharacter } from "../../../src/actors/character/StonetopCharacter.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { FakeMoveRepository } from "../../fakes/FakeMoveRepository.js";
import { FakeRepositoryFactory } from "../../fakes/FakeRepositoryFactory.js";
import { FakeGameBuilder } from "../../fakes/FakeGameBuilder.js";
import { TestPlaybookItemBuilder } from "../../fakes/TestPlaybookItemBuilder.js";
import { renderTemplate } from "../../fakes/renderTemplate.js";
import { OpenDisclosures } from "../../../src/utils/OpenDisclosures.js";
import { fire, settle } from "../../fakes/domEvents.js";

// The Moves tab, end to end (D11 applied to moves): a panel per category of the character's own
// moves, each resting on the moves taken and collapsing from a caret on its bar. The playbook's has a
// door to everything on offer — every move open, one box each, and a line saying what taking it asks.
// "Other Moves" holds what was dropped on, and offers nothing, so it has no door.

const LEVEL_UP = {
	_id: "level-up-id", name: "Level Up", type: "move",
	system: {
		slug: "level-up", moveType: "homefront",
		description: "When you **_have a quiet stretch of time_**, follow these steps:\n\n- Subtract XP.\n- Increase your level by 1.\n- Choose a new move from your playbook, or an insert class that you've unlocked.",
		steps: [{ kind: "spend" }, { kind: "advance" }, { kind: "chooseMove", tab: "moves" }],
	},
};

const FOX = "playbook-the-fox";
const move = (slug, name, { taken = 0, max = 1, order = 0, extra = {} } = {}) => ({
	_id: `m-${slug}`, type: "move", name,
	system: {
		slug, categoryKey: FOX, categoryLabel: "The Fox", categoryNote: "Choose one move each level.",
		acquired: taken > 0, instanceCount: taken, repeatMax: max, sortOrder: order,
		description: `When you **_${name.toLowerCase()}_**, something happens.`, ...extra,
	},
});

const MOVES = () => [
	move("ambush", "Ambush", { taken: 1, order: 0, extra: { rollStat: "dex" } }),
	move("quick-hands", "Quick Hands", { order: 1 }),
	move("improved-stat", "Improved Stat", { taken: 2, max: 3, order: 2 }),
	move("master-thief", "Master Thief", { order: 3, extra: { requirement: { level: 6 } } }),
	{ _id: "m-found", type: "move", name: "Found Trick",
	  system: { slug: "found-trick", categoryKey: "other", acquired: true, instanceCount: 1, repeatMax: 1, description: "A trick." } },
];

function makeSheet({ level = 5 } = {}) {
	new FakeGameBuilder().build();
	const repos = new FakeRepositoryFactory({ moves: new FakeMoveRepository([], [LEVEL_UP]) });
	const actor = new FakeCharacterActorBuilder()
		.withLevel(level).withXp(0, 8)
		.withPlaybook("the-fox").withItems([new TestPlaybookItemBuilder().withSlug("the-fox").withName("The Fox").build(), ...MOVES()])
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
		restoreViewState() {}
	};
	return { sheet: new (createStonetopCharacterSheetClass(Base))(), actor };
}

async function render(sheet) {
	const context = await sheet._prepareContext({});
	sheet.element.innerHTML = renderTemplate("systems/stonetop/templates/actor/character.hbs", context);
	document.body.replaceChildren(sheet.element);
	sheet.openDisclosures.restore(sheet.element);
	if (!sheet._wired) { await sheet._onFirstRender(context, {}); sheet._wired = true; }
	sheet._onRender(context, {});
	return sheet.element;
}

const tab = root => root.querySelector('.tab[data-tab="moves"]');
const panel = (root, key) => tab(root).querySelector(`[data-section="moves-${key}"]`);
const panels = root => [...tab(root).querySelectorAll(".stonetop-moves-panel")].map(p => p.dataset.section);
const rest = (root, key) => panel(root, key).querySelector(".stonetop-section-rest");
const choose = (root, key) => panel(root, key).querySelector(".stonetop-section-choose");
const slugs = region => [...region.querySelectorAll("li.stonetop-mrow")].map(li => li.dataset.slug);
const row = (region, slug) => region.querySelector(`li.stonetop-mrow[data-slug="${slug}"]`);
const door = (root, key) => panel(root, key).querySelector(".stonetop-section-door");
const caret = (root, key) => panel(root, key).querySelector(".stonetop-bar-toggle");
const press = async (sheet, target) => {
	await sheet.constructor.DEFAULT_OPTIONS.actions[target.dataset.action].call(sheet, new Event("click"), target);
	await settle();
};
const takes = (actor, slug) => actor.items.find(i => i.system?.slug === slug).system.instanceCount;

beforeEach(() => { document.body.innerHTML = ""; });

describe("the Moves tab (integration)", () => {
	it("sets a panel for each category the character holds, the playbook's first and Other Moves last", async () => {
		const root = await render(makeSheet().sheet);
		expect(panels(root)).toEqual([`moves-${FOX}`, "moves-other"]);
		expect(panel(root, FOX).querySelector(".stonetop-bar-title").textContent).toBe("The Fox");
	});

	it("rests each panel on the moves taken, as the rail's rows, each able to go to chat", async () => {
		const root = await render(makeSheet().sheet);
		expect(slugs(rest(root, FOX))).toEqual(["ambush", "improved-stat"]);
		expect(slugs(rest(root, "other"))).toEqual(["found-trick"]);
		expect(row(rest(root, FOX), "ambush").querySelector(".stonetop-move-chat")).not.toBeNull();
		expect(rest(root, FOX).querySelector(".stonetop-item-check")).toBeNull();
		expect(choose(root, FOX).hidden).toBe(true);
	});

	it("says a move was taken more than once after its name, and a single take not at all", async () => {
		const root = await render(makeSheet().sheet);
		expect(row(rest(root, FOX), "improved-stat").querySelector(".stonetop-mrow-times").textContent).toContain("2");
		expect(row(rest(root, FOX), "ambush").querySelector(".stonetop-mrow-times")).toBeNull();
	});

	it("gives a door only to a panel with something on offer", async () => {
		const root = await render(makeSheet().sheet);
		expect(door(root, FOX)).not.toBeNull();
		expect(door(root, "other")).toBeNull();
	});

	it("opens onto every move, each open, with one box and the playbook's note on the bar", async () => {
		const { sheet } = makeSheet();
		const root = await render(sheet);
		await press(sheet, door(root, FOX));
		const list = choose(root, FOX);
		expect(list.hidden).toBe(false);
		expect(slugs(list)).toEqual(["ambush", "quick-hands", "improved-stat", "master-thief"]);
		for (const li of list.querySelectorAll("li.stonetop-mrow"))
			expect(li.querySelector(".stonetop-move-body").hidden, li.dataset.slug).toBe(false);
		expect([...list.querySelectorAll(".stonetop-item-check")].map(b => b.checked)).toEqual([true, false, true, false]);
		expect(panel(root, FOX).querySelector(".stonetop-bar-note").textContent).toBe("Choose one move each level.");
		expect(panel(root, FOX).querySelector(".stonetop-bar-note").hidden).toBe(false);
	});

	it("says what taking a move asks: its requirement, its limit, and a way to take it again", async () => {
		const { sheet } = makeSheet();
		const root = await render(sheet);
		await press(sheet, door(root, FOX));
		const line = slug => row(choose(root, FOX), slug).querySelector(".stonetop-mrow-choosing");
		expect(line("master-thief").querySelector(".stonetop-mrow-req--unmet")).not.toBeNull();
		expect(line("master-thief").textContent).toContain("stonetop.character.moves.notMet");
		expect(line("improved-stat").textContent).toContain("Up to 3 times");
		expect(line("improved-stat").querySelector('[data-action="takeMoveAgain"]')).not.toBeNull();
		expect(line("ambush")).toBeNull();
	});

	it("takes a move from its box, and stays open across the render that causes", async () => {
		const { sheet, actor } = makeSheet();
		let root = await render(sheet);
		await press(sheet, door(root, FOX));
		const box = row(choose(root, FOX), "quick-hands").querySelector(".stonetop-item-check");
		box.checked = true;
		fire(box, "change");
		await settle();
		expect(takes(actor, "quick-hands")).toBe(1);
		root = await render(sheet);
		expect(choose(root, FOX).hidden).toBe(false);
	});

	it("clears every take when its box is cleared", async () => {
		const { sheet, actor } = makeSheet();
		const root = await render(sheet);
		await press(sheet, door(root, FOX));
		const box = row(choose(root, FOX), "improved-stat").querySelector(".stonetop-item-check");
		box.checked = false;
		fire(box, "change");
		await settle();
		expect(takes(actor, "improved-stat")).toBe(0);
	});

	it("takes a move again", async () => {
		const { sheet, actor } = makeSheet();
		const root = await render(sheet);
		await press(sheet, door(root, FOX));
		await press(sheet, row(choose(root, FOX), "improved-stat").querySelector('[data-action="takeMoveAgain"]'));
		expect(takes(actor, "improved-stat")).toBe(3);
	});

	it("shuts a panel from its caret, remembered across a render, and leaves its door alone", async () => {
		const { sheet } = makeSheet();
		let root = await render(sheet);
		const body = () => panel(root, FOX).querySelector(".stonetop-panel-body");
		expect(body().hidden).toBe(false);
		await press(sheet, caret(root, FOX));
		expect(door(root, FOX).querySelector("[data-disclosure-shut]").hidden).toBe(false);
		root = await render(sheet);
		expect(body().hidden).toBe(true);
		expect(rest(root, FOX).hidden).toBe(false);

		// Opened again, the panel is as the door left it: at rest, saying Change.
		await press(sheet, caret(root, FOX));
		expect(body().hidden).toBe(false);
		expect(rest(root, FOX).hidden).toBe(false);
		expect(door(root, FOX).querySelector("[data-disclosure-shut]").hidden).toBe(false);
	});

	it("removes a dropped move from its own row", async () => {
		const root = await render(makeSheet().sheet);
		expect(row(rest(root, "other"), "found-trick").querySelector('[data-action="deleteOtherMove"]')).not.toBeNull();
		expect(row(rest(root, FOX), "ambush").querySelector('[data-action="deleteOtherMove"]')).toBeNull();
	});

	it("has no filter and no lock", async () => {
		const root = await render(makeSheet().sheet);
		expect(tab(root).querySelector("[data-view-flag]")).toBeNull();
		expect(tab(root).classList.contains("hide-unselected")).toBe(false);
	});
});

describe("a move owed (integration)", () => {
	it("says so in the Level Up move's own words, at the top of the playbook's panel", async () => {
		const root = await render(makeSheet().sheet);
		const owed = panel(root, FOX).querySelector(".stonetop-owing");
		expect(owed.textContent).toContain("Choose a new move from your playbook");
		expect(panel(root, "other").querySelector(".stonetop-owing")).toBeNull();
	});

	it("says nothing once the move is chosen", async () => {
		const root = await render(makeSheet({ level: 4 }).sheet);
		expect(tab(root).querySelector(".stonetop-owing")).toBeNull();
	});

	it("opens the playbook's panel from its Choose", async () => {
		const { sheet } = makeSheet();
		const root = await render(sheet);
		await press(sheet, panel(root, FOX).querySelector(".stonetop-owing [data-action]"));
		expect(choose(root, FOX).hidden).toBe(false);
	});

	it("is where the Level Up checklist's step goes, with the panel open", async () => {
		const { sheet } = makeSheet();
		let root = await render(sheet);
		await press(sheet, root.querySelector('[data-view-flag="levelUpOpen"]'));
		root = await render(sheet);
		const route = root.querySelector('.stonetop-levelup-goto[data-tab="moves"]');
		expect(route.dataset.openSections).toBe(`moves-${FOX}`);
		await press(sheet, route);
		expect(choose(root, FOX).hidden).toBe(false);
	});
});
