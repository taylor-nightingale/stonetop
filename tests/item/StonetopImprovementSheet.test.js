// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createStonetopImprovementSheetClass } from "../../src/item/StonetopImprovementSheet.js";
import { withViewStateV2 } from "../../src/utils/withViewStateV2.js";
import { ImprovementProgress } from "../../src/model/snapshot/steading/ImprovementProgress.js";
import { ImprovementEditorView } from "../../src/model/snapshot/steading/ImprovementEditorView.js";
import { applyDocumentUpdate } from "../fakes/foundry/applyDocumentUpdate.js";
import { renderTemplate } from "../fakes/renderTemplate.js";
import { renderSheetPart } from "../fakes/renderSheetPart.js";

// Drives the real sheet over the real templates: _prepareContext → improvement.hbs (the board's card
// as its own editor) → the sheet's actions and change router → the item's stored data. Only core's
// ItemSheetV2 and the item document are faked; the view state is the real withViewStateV2.

const TEMPLATE = "systems/stonetop/templates/item/improvement.hbs";

function makeItem(system = {}, { name = "Watchtower" } = {}) {
	const item = { name, img: "x.png", type: "improvement", system: structuredClone(system), getRollData: () => ({}) };
	item.update = vi.fn(async data => applyDocumentUpdate(item, data));
	return item;
}

class FakeCoreItemSheet {
	constructor(item, editable) {
		this._item = item;
		this.isEditable = editable;
		this.id = "sheet";
		this.element = document.createElement("form");
		this.render = vi.fn();
		document.body.appendChild(this.element);
	}
	get item() { return this._item; }
	async _prepareContext() { return {}; }
	async _onFirstRender() {}
	_onRender() {}
	_preSyncPartState() {}
	_syncPartState() {}
}

const Sheet = createStonetopImprovementSheetClass(withViewStateV2(FakeCoreItemSheet));
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

async function render(sheet, { first = false } = {}) {
	const context = await sheet._prepareContext({});
	return renderSheetPart(sheet, renderTemplate(TEMPLATE, context), { first });
}

// Core dispatches a [data-action] click to the sheet's declared action; the fake base does not. A
// right-click by default, which is how a delete skips its question.
async function press(sheet, target, button = 2) {
	const action = sheet.constructor.DEFAULT_OPTIONS.actions[target.dataset.action];
	await (action.handler ?? action).call(sheet, new MouseEvent("click", { button }), target);
	await settle();
}

async function change(el, value) {
	if (typeof value === "boolean") el.checked = value; else el.value = String(value);
	el.dispatchEvent(new Event("change", { bubbles: true }));
	await settle();
}

const line = text => ({ type: "entry", content: { title: null, text }, track: null });
const req  = (slug, text = slug, max = 1) => ({ type: "entry", slug, content: { title: null, text }, track: { max } });
const WATCHTOWER = () => ({
	slug: "watchtower",
	choices: { slug: "watchtower", list: [line("Keep the watch."), line("Requires all:"), req("timber", "Timber"), req("raise", "Raise it", 2)] },
	requires: { all: ["timber", "raise"] },
	effects: [
		{ when: { kind: "completed" }, change: { target: "defenses", amount: 1 }, text: "increase Defenses by 1" },
		{ when: { kind: "turn", seasons: ["spring"] }, text: "you are extra happy" },
	],
});

function stubGame() {
	const empty = { getIndex: async () => {}, index: [], getDocuments: async () => [], folders: [] };
	vi.stubGlobal("game", { ...globalThis.game, packs: { get: () => empty }, items: { contents: [] } });
}

beforeEach(() => { document.body.innerHTML = ""; stubGame(); });
afterEach(() => vi.unstubAllGlobals());

async function opened(system = WATCHTOWER(), options) {
	const item  = makeItem(system);
	const sheet = new Sheet(item, options?.editable ?? true);
	const root  = await render(sheet, { first: true });
	return { item, sheet, root };
}
const rowAt     = (root, i) => root.querySelector(`.stonetop-improvement-row[data-index="${i}"]`);
const headingAt = (root, i) => root.querySelector(`.stonetop-improvement-heading[data-index="${i}"]`);
// A heading's editor hangs from the foot of its section, not from the heading.
const sectionOf = (root, i) => headingAt(root, i).closest(".stonetop-improvement-section");
const resultAt  = (root, i) => root.querySelector(`[data-result-index="${i}"]`);

describe("StonetopImprovementSheet — the card", () => {
	it("measures the meter against the improvement's rule, nothing ticked", async () => {
		const sheet = new Sheet(makeItem(WATCHTOWER()), true);
		const ctx = await sheet._prepareContext({});
		expect(ctx.card).toBeInstanceOf(ImprovementProgress);
		expect(ctx.editor).toBeInstanceOf(ImprovementEditorView);
		expect([ctx.card.ticked, ctx.card.total]).toEqual([0, 3]);
	});

	// A heading groups the requirements it governs — it never says "requires all" and then nothing.
	it("draws each heading over the requirements it governs, as one group", async () => {
		const { root } = await opened();
		const section = root.querySelector(".stonetop-improvement-section");
		expect(section.querySelector(".stonetop-improvement-heading").textContent).toContain("Requires all:");
		expect([...section.querySelectorAll(".stonetop-improvement-section-rows .stonetop-improvement-row")].map(r => r.dataset.index)).toEqual(["2", "3"]);
		expect(rowAt(root, 0).closest(".stonetop-improvement-section")).toBeNull();
	});

	it("draws each requirement as the card does: its boxes beside its words", async () => {
		const { root } = await opened();
		expect(rowAt(root, 3).querySelectorAll(".stonetop-cg-track")).toHaveLength(2);
		expect(rowAt(root, 3).querySelector(".stonetop-editable__display").textContent).toContain("Raise it");
	});

	// One way to edit each thing — the old sheet drew a second pencil on every row that opened nothing.
	it("gives each row exactly one edit control, and every one opens something", async () => {
		const { root } = await opened();
		for (const row of root.querySelectorAll(".stonetop-improvement-row, .stonetop-improvement-heading, .stonetop-improvement-result")) {
			const edits = row.querySelectorAll(":scope > .stonetop-improvement-line-main :is(.stonetop-edit-toggle, .stonetop-improvement-edit)");
			expect(edits.length, row.outerHTML.slice(0, 80)).toBe(1);
		}
		for (const opener of root.querySelectorAll(".stonetop-improvement-edit")) {
			expect(Sheet.DEFAULT_OPTIONS.actions[opener.dataset.action], opener.dataset.action).toBeDefined();
		}
	});

	it("uses the system's trash for every remove", async () => {
		const { root } = await opened();
		for (const remove of root.querySelectorAll("[data-action^='remove']")) {
			expect(remove.querySelector("img").getAttribute("src")).toContain("delete-icon.png");
		}
	});

	it("draws a locked improvement as the board's card, with no revoke and no editor", async () => {
		const { root } = await opened(WATCHTOWER(), { editable: false });
		expect(root.querySelector(".stonetop-improvement-editor")).toBeNull();
		expect(root.querySelector("[data-action='revokeImprovement']")).toBeNull();
		expect(root.querySelector(".steading-improvement-body").hidden).toBe(false);
	});
});

describe("StonetopImprovementSheet — the rows", () => {
	it("adds a requirement to its section, a heading, and a line", async () => {
		const { item, sheet, root } = await opened();
		await press(sheet, root.querySelector("[data-action='addRequirementTo']"));
		expect(item.system.requires.all).toHaveLength(3);
		await press(sheet, root.querySelector("[data-action='addHeading']"));
		await press(sheet, root.querySelector("[data-action='addLine']"));
		expect(item.system.choices.list).toHaveLength(8);
	});

	it("writes a row's words where they sit", async () => {
		const { item, root } = await opened();
		await change(rowAt(root, 2).querySelector("[data-change-action='lineText']"), "Seasoned timber");
		expect(item.system.choices.list[2].content.text).toBe("Seasoned timber");
	});

	it("steps a requirement's boxes", async () => {
		const { item, sheet, root } = await opened();
		await press(sheet, rowAt(root, 2).querySelector("[data-action='stepBoxes'][data-step='1']"));
		expect(item.system.choices.list[2].track.max).toBe(2);
	});

	it("moves a requirement within its section", async () => {
		const { item, sheet, root } = await opened();
		await press(sheet, rowAt(root, 3).querySelector("[data-action='moveRequirement'][data-step='-1']"));
		expect(item.system.choices.list.map(r => r.slug ?? null)).toEqual([null, null, "raise", "timber"]);
	});

	it("moves a line past a section as a whole", async () => {
		const { item, sheet, root } = await opened();
		await press(sheet, rowAt(root, 0).querySelector("[data-action='moveBlock'][data-step='1']"));
		expect(item.system.choices.list.map(r => r.slug ?? r.content.text)).toEqual(["Requires all:", "timber", "raise", "Keep the watch."]);
	});

	// The last requirement out takes its heading with it: a heading never says nothing.
	it("removes a section whole when its last requirement goes", async () => {
		const system = WATCHTOWER();
		system.choices.list.pop();
		system.requires = { all: ["timber"] };
		const { item, sheet, root } = await opened(system);
		const remove = rowAt(root, 2).querySelector("[data-action='removeSection']");
		expect(remove).not.toBeNull();
		await press(sheet, remove);
		expect(item.system.choices.list.map(r => r.content.text)).toEqual(["Keep the watch."]);
	});
});

describe("StonetopImprovementSheet — a heading's editor", () => {
	async function openHeading() {
		const opened_ = await opened();
		await press(opened_.sheet, headingAt(opened_.root, 1).querySelector("[data-action='openHeading']"), 0);
		return { ...opened_, root: await render(opened_.sheet) };
	}

	// The rule is about the section's requirements; the editor opens under them, leaving them in view.
	it("opens from the heading's edit icon, hanging from the foot of its section", async () => {
		const { root } = await openHeading();
		const section = sectionOf(root, 1);
		const panel = section.querySelector(":scope > .stonetop-improvement-panel");
		expect(panel).not.toBeNull();
		expect(section.querySelector(".stonetop-improvement-section-rows").compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		expect(headingAt(root, 1).querySelector(".stonetop-improvement-panel")).toBeNull();
	});

	it("sets the rule from its line of words, and how many", async () => {
		const { item, sheet, root } = await openHeading();
		await change(sectionOf(root, 1).querySelector("[data-change-action='sectionRule'][value='some']"), true);
		expect(item.system.requires).toEqual({ any: 1, of: ["timber", "raise"] });
		const again = await render(sheet);
		await change(sectionOf(again, 1).querySelector("[data-change-action='sectionCount']"), 2);
		expect(item.system.requires).toEqual({ any: 2, of: ["timber", "raise"] });
	});

	// The line of words is the roll-mode picker, whose help button (D9) belongs to the roll mode only;
	// a heading's own `rule` once leaked into it and drew that button here.
	it("draws its line of words without the roll mode's help button", async () => {
		const { root } = await openHeading();
		expect(sectionOf(root, 1).querySelector(".stonetop-rollmode-rule")).toBeNull();
	});

	// The heading it hangs from is the card's own statement; a preview at the editor's head said it twice.
	it("repeats nothing the heading above it already says", async () => {
		const { root } = await openHeading();
		expect(sectionOf(root, 1).querySelector(".stonetop-improvement-panel .stonetop-improvement-panel-preview")).toBeNull();
	});

	it("shuts with Done", async () => {
		const { sheet, root } = await openHeading();
		await press(sheet, root.querySelector("[data-action='closePart']"), 0);
		expect((await render(sheet)).querySelector(".stonetop-improvement-panel")).toBeNull();
	});
});

describe("StonetopImprovementSheet — a result's editor", () => {
	async function openResult(index, system) {
		const opened_ = await opened(system);
		await press(opened_.sheet, resultAt(opened_.root, index).querySelector("[data-action='openResult']"), 0);
		return { ...opened_, root: await render(opened_.sheet) };
	}

	it("sets what the sheet does, the rating and the amount, saving as it goes", async () => {
		const { item, sheet, root } = await openResult(0);
		await change(resultAt(root, 0).querySelector("[data-change-action='resultRating'][value='fortunes']"), true);
		let again = await render(sheet);
		await change(resultAt(again, 0).querySelector("[data-change-action='resultAmount']"), 2);
		expect(item.system.effects[0].change).toEqual({ target: "fortunes", amount: 2 });
		again = await render(sheet);
		await change(resultAt(again, 0).querySelector("[data-change-action='resultDoes'][value='nothing']"), true);
		expect(item.system.effects[0].change).toBeUndefined();
	});

	it("sets which seasons from its boxes", async () => {
		const { item, root } = await openResult(1);
		await change(resultAt(root, 1).querySelector("[data-change-action='resultSeason'][value='autumn']"), true);
		expect(item.system.effects[1].when.seasons).toEqual(["spring", "autumn"]);
	});

	// The moment is typed, not picked from a list: anything not already in use is a moment of its own.
	it("takes a typed moment of its own", async () => {
		const { item, sheet, root } = await openResult(1);
		await change(resultAt(root, 1).querySelector("[data-change-action='resultWhen'][value='moment']"), true);
		const again = await render(sheet);
		await change(resultAt(again, 1).querySelector("[data-change-action='resultMoment']"), "the spring festival");
		expect(item.system.effects[1].when).toMatchObject({ kind: "moment", seasons: ["spring"], momentName: "the spring festival" });
		expect(item.system.effects[1].when.moment).toMatch(/^custom-moment-/);
	});

	it("repeats nothing the result above it already says", async () => {
		const { root } = await openResult(1);
		expect(resultAt(root, 1).querySelector(".stonetop-improvement-panel .stonetop-improvement-panel-preview")).toBeNull();
	});

	it("writes a result's words", async () => {
		const { item, root } = await openResult(1);
		await change(resultAt(root, 1).querySelector("[data-change-action='resultText']"), "everyone is extra happy");
		expect(item.system.effects[1].text).toBe("everyone is extra happy");
	});

	it("moves and removes a result", async () => {
		const system = WATCHTOWER();
		system.effects.push({ when: { kind: "completed" }, text: "second" });
		const { item, sheet, root } = await opened(system);
		await press(sheet, resultAt(root, 2).querySelector("[data-action='moveResult'][data-step='-1']"));
		expect(item.system.effects.map(e => e.text)).toEqual(["second", "you are extra happy", "increase Defenses by 1"]);
		await press(sheet, resultAt(root, 0).querySelector("[data-action='removeResult']"));
		expect(item.system.effects).toHaveLength(2);
	});
});

/** The adder: nothing is written until Add; Done shuts it and keeps nothing. */
describe("StonetopImprovementSheet — adding a result", () => {
	async function openAdder(half = "completion") {
		const opened_ = await opened();
		await press(opened_.sheet, opened_.root.querySelector(`[data-action='openResultAdder'][data-half='${half}']`), 0);
		return { ...opened_, root: await render(opened_.sheet) };
	}

	it("hangs from the add that opened it, and writes nothing while it is drafted", async () => {
		const { item, sheet, root } = await openAdder();
		const adder = root.querySelector(".stonetop-improvement-adder");
		expect(adder.closest(".stonetop-improvement-anchor").querySelector("[data-action='openResultAdder']")).not.toBeNull();
		await change(adder.querySelector("[data-change-action='resultDoes'][value='change']"), true);
		await change((await render(sheet)).querySelector(".stonetop-improvement-adder [data-change-action='resultText']"), "a party");
		expect(item.update).not.toHaveBeenCalled();
		expect(sheet.editing.draft.text).toBe("a party");
	});

	// Nothing above the adder states the new result yet, so it is headed by the card's statement of it.
	it("is headed by the result as the card will state it", async () => {
		const { root } = await openAdder();
		expect(root.querySelector(".stonetop-improvement-adder .stonetop-improvement-panel-preview")).not.toBeNull();
	});

	it("writes the draft on Add", async () => {
		const { item, sheet, root } = await openAdder("henceforth");
		await change(root.querySelector(".stonetop-improvement-adder [data-change-action='resultText']"), "the bells ring");
		await press(sheet, (await render(sheet)).querySelector("[data-action='addResultDraft']"), 0);
		expect(item.system.effects.at(-1)).toMatchObject({ when: { kind: "turn" }, text: "the bells ring" });
		expect(sheet.editing.draft).toBeNull();
	});

	it("keeps nothing on Done", async () => {
		const { item, sheet, root } = await openAdder();
		await press(sheet, root.querySelector(".stonetop-improvement-adder [data-action='closePart']"), 0);
		expect(item.update).not.toHaveBeenCalled();
		expect((await render(sheet)).querySelector(".stonetop-improvement-adder")).toBeNull();
	});
});

/** Every editor is labelled groups and a foot: no blank head, no unlabelled field. */
describe("StonetopImprovementSheet — the shape of an editor", () => {
	const groupsOf = panel => [...panel.querySelectorAll(":scope > fieldset > legend")].map(l => l.textContent.trim());

	it("gives a heading's editor its rule and its words, and a foot with Done", async () => {
		const { sheet, root } = await opened();
		await press(sheet, headingAt(root, 1).querySelector("[data-action='openHeading']"), 0);
		const panel = sectionOf(await render(sheet), 1).querySelector(".stonetop-improvement-panel");
		expect(panel.querySelector(".stonetop-improvement-panel-head")).toBeNull();
		expect(groupsOf(panel)).toEqual(["stonetop.improvement.rule.lead", "stonetop.improvement.words.label"]);
		expect(panel.querySelector(".stonetop-improvement-panel-foot [data-action='closePart']")).not.toBeNull();
	});

	it("gives a result's editor when, what the sheet does and its words, and a foot with Done", async () => {
		const { sheet, root } = await opened();
		await press(sheet, resultAt(root, 1).querySelector("[data-action='openResult']"), 0);
		const panel = resultAt(await render(sheet), 1).querySelector(".stonetop-improvement-panel");
		expect(panel.querySelector(".stonetop-improvement-panel-head")).toBeNull();
		expect(groupsOf(panel)).toEqual(["stonetop.improvement.when.lead", "stonetop.improvement.does.lead", "stonetop.improvement.words.label"]);
		expect(panel.querySelector(".stonetop-improvement-panel-foot [data-action='closePart']")).not.toBeNull();
	});

	// The adder has a title, so its head is not blank; its foot carries Add.
	it("heads the adder with its title and Done, and puts Add in its foot", async () => {
		const { sheet, root } = await opened();
		await press(sheet, root.querySelector("[data-action='openResultAdder'][data-half='henceforth']"), 0);
		const adder = (await render(sheet)).querySelector(".stonetop-improvement-adder");
		expect(adder.querySelector(".stonetop-improvement-panel-head [data-action='closePart']")).not.toBeNull();
		expect(groupsOf(adder)).toHaveLength(3);
		expect(adder.querySelector(".stonetop-improvement-panel-foot [data-action='addResultDraft']")).not.toBeNull();
	});
});

describe("StonetopImprovementSheet — what the editors write", () => {
	// A domain method persists these; core's form submit must not also write them as junk keys.
	it("marks every control in an editor as persisted by the sheet, not by core's submit", async () => {
		const { sheet, root } = await opened();
		await press(sheet, resultAt(root, 1).querySelector("[data-action='openResult']"), 0);
		const again = await render(sheet);
		const controls = again.querySelectorAll(".stonetop-improvement-panel :is(input, textarea)");
		expect(controls.length).toBeGreaterThan(0);
		for (const el of controls) expect(el.dataset.changeAction, el.outerHTML.slice(0, 80)).toBeTruthy();
	});

	it("gives every text field a hint", async () => {
		const { sheet, root } = await opened();
		await press(sheet, resultAt(root, 1).querySelector("[data-action='openResult']"), 0);
		const again = await render(sheet);
		for (const el of again.querySelectorAll(".stonetop-improvement-panel :is(input[type='text'], textarea)")) {
			expect(el.getAttribute("placeholder"), el.outerHTML.slice(0, 80)).toBeTruthy();
		}
	});
});

/**
 * Every combination of when × what the sheet does, for a saved result and for the adder's draft.
 *
 * The bug this exists for: choosing "for as long as it stands" on a result with no words yet sent it
 * to the other half and took every choice of when with it. Each combination must leave the result
 * in Henceforth, still offer every choice, and put each chosen option's own fields under it.
 */
describe("StonetopImprovementSheet — every combination of when and what the sheet does", () => {
	const WHEN = {
		turn:     { seasons: true,  moment: false, outcome: true,  phrase: true },
		moment:   { seasons: true,  moment: true,  outcome: true,  phrase: true },
		standing: { seasons: false, moment: false, outcome: false, phrase: true },
	};
	const DOES = {
		nothing: { detail: false },
		change:  { detail: true, ratings: 5, amount: true },
		list:    { detail: true, lists: 3, entry: true },
		set:     { detail: true, ratings: 6, values: 4 },
	};
	const detailUnder = (panel, action) =>
		panel.querySelector(`[data-change-action='${action}']:checked`)?.closest("label")?.nextElementSibling;
	const count = (el, action) => el?.querySelectorAll(`[data-change-action='${action}']`).length ?? 0;

	async function check(panelOf, sheet, when, does, item) {
		let root = await render(sheet);
		await change(panelOf(root).querySelector(`[data-change-action='resultWhen'][value='${when}']`), true);
		root = await render(sheet);
		await change(panelOf(root).querySelector(`[data-change-action='resultDoes'][value='${does}']`), true);
		root = await render(sheet);
		const panel = panelOf(root);

		expect(count(panel, "resultWhen"), "every when is still offered").toBe(3);
		expect(count(panel, "resultDoes"), "everything the sheet does is still offered").toBe(4);
		expect(panel.querySelector("[data-change-action='resultWhen']:checked").value).toBe(when);
		expect(panel.querySelector("[data-change-action='resultDoes']:checked").value).toBe(does);
		// Still in Henceforth: the panel sits in the card's second half.
		const halves = [...root.querySelectorAll(".steading-payoff > .steading-statement-lines, .steading-payoff > .stonetop-improvement-anchor")];
		expect(halves.indexOf(panel.closest(".steading-payoff > *")), "stays in Henceforth").toBeGreaterThanOrEqual(2);

		const w = detailUnder(panel, "resultWhen");
		expect(Boolean(count(w, "resultSeason")), `${when}: seasons`).toBe(WHEN[when].seasons);
		expect(Boolean(count(w, "resultMoment")), `${when}: moment`).toBe(WHEN[when].moment);
		expect(Boolean(count(w, "resultOutcome")), `${when}: roll`).toBe(WHEN[when].outcome);
		expect(Boolean(count(w, "resultPhrase")), `${when}: words for when`).toBe(WHEN[when].phrase);

		const d = detailUnder(panel, "resultDoes");
		expect(d?.classList.contains("stonetop-rollmode-detail") ?? false, `${does}: detail`).toBe(DOES[does].detail);
		if (DOES[does].ratings) expect(count(d, "resultRating"), `${does}: ratings`).toBe(DOES[does].ratings);
		if (DOES[does].amount)  expect(count(d, "resultAmount"), `${does}: amount`).toBe(1);
		if (DOES[does].lists)   expect(count(d, "resultList"), `${does}: lists`).toBe(DOES[does].lists);
		if (DOES[does].entry)   expect(count(d, "resultEntry"), `${does}: entry`).toBe(1);
		if (DOES[does].values)  expect(count(d, "resultSetValue"), `${does}: values`).toBe(DOES[does].values);
		return item;
	}

	const combinations = Object.keys(WHEN).flatMap(when => Object.keys(DOES).map(does => [when, does]));

	it.each(combinations)("a saved result: when %s, the sheet %s", async (when, does) => {
		const system = WATCHTOWER();
		system.effects[1].text = "";
		const { item, sheet, root } = await opened(system);
		await press(sheet, resultAt(root, 1).querySelector("[data-action='openResult']"), 0);
		await check(r => resultAt(r, 1).querySelector(".stonetop-improvement-panel"), sheet, when, does, item);
		expect(item.system.effects[1].when.kind === "completed" ? "standing" : item.system.effects[1].when.kind).toBe(when);
	});

	it.each(combinations)("the adder's draft: when %s, the sheet %s", async (when, does) => {
		const { item, sheet, root } = await opened();
		await press(sheet, root.querySelector("[data-action='openResultAdder'][data-half='henceforth']"), 0);
		await check(r => r.querySelector(".stonetop-improvement-adder"), sheet, when, does, item);
		expect(item.update).not.toHaveBeenCalled();
	});
});
