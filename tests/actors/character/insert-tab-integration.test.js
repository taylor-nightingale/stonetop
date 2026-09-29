// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createStonetopCharacterSheetClass } from "../../../src/actors/character/StonetopCharacterSheet.js";
import { StonetopCharacter } from "../../../src/actors/character/StonetopCharacter.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { FakeRepositoryFactory } from "../../fakes/FakeRepositoryFactory.js";
import { FakeGameBuilder } from "../../fakes/FakeGameBuilder.js";
import { TestPlaybookItemBuilder } from "../../fakes/TestPlaybookItemBuilder.js";
import { renderTemplate } from "../../fakes/renderTemplate.js";
import { OpenDisclosures } from "../../../src/utils/OpenDisclosures.js";
import { settle } from "../../fakes/domEvents.js";

// An insert's tab, end to end (D12): straight after the Playbook's, with the whole insert on it — its
// moves, its instinct and its sections, drawn as the Playbook tab's are. An insert arriving opens up; only the sheet it was dropped on goes to its tab. No lock.

const THRALL = (choiceValues = {}) => ({
	_id: "thrall-item", type: "insert", name: "The Thrall",
	system: {
		slug: "thrall", choiceValues, description: "You serve another.",
		instinct: { slug: "instinct", list: [{ type: "pick", pickCount: 1, options: [
			{ slug: "fascination", content: { title: "Fascination", text: "To explore your powers." } },
		]}]},
		choices: [
			{ slug: "your-master", list: [
				{ type: "entry", content: { title: "Your Master", text: "Name them." } },
				{ type: "entry", slug: "master", content: { text: "My master is" }, input: { type: "inline" } },
			] },
			{ slug: "terrible-purpose", list: [
				{ type: "entry", content: { title: "Terrible Purpose", text: "Choose one." } },
				{ type: "entry", slug: "duty", content: { text: "Duty: name the task.\n\nWhen you work at it, regain all your HP." },
				  track: { max: 1 }, input: { type: "inline", follows: "lead" } },
				{ type: "entry", slug: "longing", content: { text: "Longing: name them.\n\nWhen you watch them, clear your debilities." },
				  track: { max: 1 }, input: { type: "inline", follows: "lead" } },
			] },
			{ slug: "consequences", list: [
				{ type: "entry", content: { title: "Consequences", text: "Mark one." } },
				{ type: "entry", slug: "stench", content: { text: "Carrion stench" }, track: { max: 1 } },
			] },
		],
	},
});

const FAVOR = {
	_id: "m-favor", type: "move", name: "Favor",
	system: { slug: "favor", categoryKey: "insert-thrall", acquired: true, instanceCount: 1,
		description: "When you **_ask your master for aid_**, roll +WIS.", rollStat: "wis" },
};

const playbook = () => new TestPlaybookItemBuilder().withSlug("the-fox").withName("The Fox").build();

function makeSheet({ thrall = true, choiceValues = {} } = {}) {
	new FakeGameBuilder().build();
	const actor = new FakeCharacterActorBuilder()
		.withPlaybook("the-fox").withItems([playbook(), ...(thrall ? [THRALL(choiceValues), FAVOR] : [])])
		.withTypedActor(a => new StonetopCharacter(a, new FakeRepositoryFactory()))
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
		async _onDropItem() {}
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

const insertTab = root => root.querySelector('.tab[data-tab="insert-thrall"]');
const section = (root, key) => insertTab(root).querySelector(`[data-section="${key}"]`);
const open = (root, key) => {
	const body = section(root, key).querySelector(".stonetop-section-choose");
	return Boolean(body) && !body.hidden;
};
const press = async (sheet, target) => {
	await sheet.constructor.DEFAULT_OPTIONS.actions[target.dataset.action].call(sheet, new Event("click"), target);
	await settle();
};

beforeEach(() => { document.body.innerHTML = ""; });

describe("an insert's tab (integration)", () => {
	it("comes straight after the Playbook's", () => {
		const { sheet } = makeSheet();
		expect(sheet._getTabsConfig("primary").tabs.map(t => t.id).slice(0, 3)).toEqual(["playbook", "insert-thrall", "moves"]);
	});

	it("carries the insert's moves, and the Moves tab does not", async () => {
		const root = await render(makeSheet().sheet);
		const moves = insertTab(root).querySelector(".stonetop-insert-moves");
		expect([...moves.querySelectorAll("li.stonetop-mrow")].map(li => li.dataset.slug)).toEqual(["favor"]);
		expect(moves.querySelector(".stonetop-move-chat")).not.toBeNull();
		expect(root.querySelector('.tab[data-tab="moves"]').textContent).not.toContain("Favor");
	});

	it("sets its instinct and each section in the pack's order, across two columns", async () => {
		const root = await render(makeSheet().sheet);
		const [left, right] = insertTab(root).querySelectorAll(".stonetop-section-column");
		const keys = col => [...col.querySelectorAll("[data-section]")].map(s => s.dataset.section);
		expect(keys(left)).toEqual(["insert-thrall-instinct", "insert-thrall-your-master"]);
		expect(keys(right)).toEqual(["insert-thrall-terrible-purpose", "insert-thrall-consequences"]);
	});

	it("rests a section from its door, and opens it", async () => {
		const { sheet } = makeSheet();
		const root = await render(sheet);
		expect(open(root, "insert-thrall-consequences")).toBe(false);
		await press(sheet, section(root, "insert-thrall-consequences").querySelector(".stonetop-section-door"));
		expect(open(root, "insert-thrall-consequences")).toBe(true);
	});

	// Reported: the Terrible Purpose had no Change. It rests on the purpose chosen, in full — the
	// words it heals by — and Change opens all of them again.
	it("rests the Terrible Purpose on the one chosen, in full, with a Change door to the others", async () => {
		const { sheet } = makeSheet({ choiceValues: { "terrible-purpose": { longing: 1 } } });
		let root = await render(sheet);
		const purpose = () => section(root, "insert-thrall-terrible-purpose");
		const door = purpose().querySelector(".stonetop-section-door");
		expect(door.querySelector("[data-disclosure-shut]").textContent).toMatch(/change/i);
		const rest = purpose().querySelector(".stonetop-section-rest").textContent;
		expect(rest).toContain("When you watch them, clear your debilities.");
		expect(rest).not.toContain("Duty");
		expect(purpose().querySelector(".stonetop-bar-title").textContent).toBe("Terrible Purpose");

		await press(sheet, door);
		expect(open(root, "insert-thrall-terrible-purpose")).toBe(true);
		expect(purpose().querySelector(".stonetop-section-choose").querySelectorAll(".stonetop-cg-track")).toHaveLength(2);
	});

	// Reported: the blank sat under all of a purpose's triggers. It follows the sentence it answers.
	it("sets a purpose's blank straight after the sentence it answers, before the triggers", async () => {
		const { sheet } = makeSheet();
		const root = await render(sheet);
		await press(sheet, section(root, "insert-thrall-terrible-purpose").querySelector(".stonetop-section-door"));
		const choose = section(root, "insert-thrall-terrible-purpose").querySelector(".stonetop-section-choose");
		const desc = choose.querySelector('[data-cg-option="longing"]').closest(".stonetop-choice-track").querySelector(".stonetop-choice-track-desc");
		const blank = desc.querySelector('textarea[data-cg-option="longing-input"]');
		expect(blank, "the blank is not in the purpose's text").not.toBeNull();
		const before = desc.textContent.slice(0, desc.textContent.indexOf("When you watch them"));
		expect(before).toContain("Longing: name them.");
		expect(blank.compareDocumentPosition(desc.lastChild) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		const textAfter = [...desc.childNodes].slice([...desc.childNodes].indexOf(blank) + 1).map(n => n.textContent).join("");
		expect(textAfter).toContain("When you watch them, clear your debilities.");
		expect(choose.querySelectorAll('textarea[data-cg-option="longing-input"]'), "a second blank at the row's end").toHaveLength(1);
	});

	it("saves the name written in a purpose's blank, and rests on it after the sentence", async () => {
		const { sheet, actor } = makeSheet({ choiceValues: { "terrible-purpose": { longing: 1 } } });
		let root = await render(sheet);
		const blank = section(root, "insert-thrall-terrible-purpose").querySelector('textarea[data-cg-option="longing-input"]');
		blank.value = "Mira";
		blank.dispatchEvent(new Event("change", { bubbles: true }));
		await settle();
		const insert = actor.items.find(i => i.type === "insert");
		expect(insert.system.choiceValues["terrible-purpose"]["longing-input"]).toBe("Mira");

		root = await render(sheet);
		const rest = section(root, "insert-thrall-terrible-purpose").querySelector(".stonetop-section-rest").textContent.replace(/\s+/g, " ");
		expect(rest).toMatch(/Longing: name them\. Mira When you watch them, clear your debilities\./);
	});

	it("offers Choose on the Terrible Purpose until one is marked", async () => {
		const root = await render(makeSheet().sheet);
		const door = section(root, "insert-thrall-terrible-purpose").querySelector(".stonetop-section-door");
		expect(door.querySelector("[data-disclosure-shut]").textContent).toMatch(/choose/i);
	});

	it("has no lock", async () => {
		const root = await render(makeSheet().sheet);
		expect(insertTab(root).querySelector("[data-view-flag]")).toBeNull();
		expect(insertTab(root).querySelector(".stonetop-insert-remove")).not.toBeNull();
	});
});

describe("an insert arriving (integration)", () => {
	it("opens its sections on the sheet, where it rests open until closed", async () => {
		const { sheet } = makeSheet({ thrall: false });
		let root = await render(sheet);
		await sheet.typedActor.applyDroppedItems([THRALL()]);
		root = await render(sheet);
		for (const key of ["insert-thrall-instinct", "insert-thrall-your-master", "insert-thrall-consequences"])
			expect(open(root, key), `${key} did not open`).toBe(true);
	});

	it("goes to its tab on the sheet it was dropped on", async () => {
		const { sheet } = makeSheet({ thrall: false });
		await render(sheet);
		const dropped = THRALL();
		await sheet._onDropItem({}, { type: "insert", system: dropped.system, parent: null, toObject: () => dropped });
		await render(sheet);
		expect(sheet.changeTab).toHaveBeenCalledWith("insert-thrall", "primary");
	});

	it("leaves another open sheet where its reader is", async () => {
		const { sheet } = makeSheet({ thrall: false });
		await render(sheet);
		await sheet.typedActor.applyDroppedItems([THRALL()]);
		await render(sheet);
		expect(sheet.changeTab).not.toHaveBeenCalled();
	});
});
