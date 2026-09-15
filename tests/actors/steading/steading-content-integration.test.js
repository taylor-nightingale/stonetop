// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createStonetopSteadingSheetClass } from "../../../src/actors/steading/StonetopSteadingSheet.js";
import { StonetopSteading } from "../../../src/actors/steading/StonetopSteading.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";
import { stonetopActorSheetBase } from "../../fakes/foundry/stonetopActorSheetBase.js";
import { steadingRepos } from "../../fakes/FakeSteadingRepos.js";
import { renderTemplate } from "../../fakes/renderTemplate.js";
import { renderSheetPart } from "../../fakes/renderSheetPart.js";
import { toRollableMarkup } from "../../../src/utils/enrichGameText.js";
import { readFileSync } from "fs";
import path from "path";

const procedureCopy = () =>
	JSON.parse(readFileSync(path.resolve(process.cwd(), "languages/en.json"), "utf8"))
		.stonetop.steading.content.procedure;

const STEADING_TEMPLATE = "systems/stonetop/templates/actor/steading.hbs";

/**
 * The Content tab end to end, with only Foundry faked: the real sheet, the real template and its real
 * partials, the real SteadingContent, driven through the real action map and change-action router
 * down to actor state.
 *
 * What it guards is the shape of the tab. These are LISTS — the move that maintains them says
 * "update the lists", and each entry is separately added and separately withdrawn — where they used
 * to be three boxes of prose that could be rewritten but never added to. A unit test over
 * SteadingContent proves the list operations work and says nothing about whether a button on the tab
 * ever reaches one, which is the failure this file exists to catch.
 */
function makeSheet(existingActor = null) {
	const actor = existingActor ?? new FakeSteadingBuilder().build();
	actor.typedActor ??= new StonetopSteading(actor, steadingRepos());
	const sheet = new (createStonetopSteadingSheetClass(stonetopActorSheetBase()))(actor);
	sheet.id = "steading-1";
	sheet.isEditable = true;
	document.body.append(sheet.element);
	return { sheet, actor };
}

async function render(sheet, first = false) {
	return renderSheetPart(sheet, renderTemplate(STEADING_TEMPLATE, await sheet._prepareContext({})), { first });
}

/** Invoke a data-action the way core does: handler.call(app, event, target). Right-click skips the
 *  delete confirmation, which is the path core dispatches for `buttons: [0, 2]`. */
async function act(sheet, name, target, ev = { type: "click", button: 0 }) {
	const def = sheet.constructor.DEFAULT_OPTIONS.actions[name];
	const handler = typeof def === "function" ? def : def.handler;
	await handler.call(sheet, { preventDefault() {}, ...ev }, target);
}

// By role as well as by tab: the nav BUTTON carries the same data-tab, and matches first.
const panel    = root => root.querySelector('[role="tabpanel"][data-tab="content"]');
const sections = root => [...panel(root).querySelectorAll(".steading-content-section")];
const sectionFor = (root, slug) =>
	sections(root).find(s => s.querySelector(`[data-slug="${slug}"]`));
const entries  = section => [...section.querySelectorAll(".stonetop-content-item")];
// The heading's own words, without the gloss that shares its line.
const headingOf = section =>
	[...section.querySelector("h3").childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("").trim();
const addIn    = section => section.querySelector(".stonetop-content-item-add");

beforeEach(() => { document.body.innerHTML = ""; });
afterEach(() => vi.unstubAllGlobals());

describe("the Content tab (integration)", () => {
	it("renders the book's three lists, in the order it prints them", async () => {
		const root = await render(makeSheet().sheet, true);
		expect(sections(root).map(headingOf)).toEqual([
			"stonetop.steading.content.sections.excluded.label",
			"stonetop.steading.content.sections.veiled.label",
			"stonetop.steading.content.sections.specialHandling.label",
		]);
	});

	// The gloss the book prints under two of the three headings. It is DOM text, not a tooltip: a
	// rule that only exists on hover is invisible to assistive tech and unreachable by touch.
	it("states the gloss the book prints under a heading that has one", async () => {
		const root = await render(makeSheet().sheet, true);
		expect(sectionFor(root, "excluded").querySelector(".stonetop-section-note").textContent.trim())
			.toBe("stonetop.steading.content.sections.excluded.note");
		expect(sectionFor(root, "specialHandling").querySelector(".stonetop-section-note")).toBeNull();
	});

	// Quoted whole, beside the lists rather than above them: it is what the table reaches for
	// mid-session, when someone has called time out, and it is read WHILE the lists are.
	//
	// In two halves, because the render harness resolves a key-only localize to its key: the tab asks
	// for the right string, and that string is the book's procedure. It used to be neither — a blob of
	// <p> tags built in SteadingDefaults.js, untranslatable and rendered nowhere.
	it("asks for the playbook's procedure, beside the lists", async () => {
		const root = await render(makeSheet().sheet, true);
		const procedure = panel(root).querySelector(".steading-content-procedure");

		expect(procedure.textContent.trim()).toBe("stonetop.steading.content.procedure");
		expect(procedure.compareDocumentPosition(sectionFor(root, "excluded")))
			.toBe(Node.DOCUMENT_POSITION_PRECEDING);
	});

	it("carries the book's own words for it, with its emphasis intact", () => {
		const html = toRollableMarkup(procedureCopy(), { autoRoll: false });

		expect(html).toContain("play stops");
		expect(html).toContain("update the lists");
		// Markdown, so the book's emphasis on each trigger survives into the sheet.
		expect(html).toContain("<strong><em>anyone calls");
	});

	it("adds an entry to the list whose button was pressed, and no other", async () => {
		const { sheet, actor } = makeSheet();
		const root = await render(sheet, true);

		await act(sheet, "addContentItem", addIn(sectionFor(root, "veiled")));

		expect(actor.system.content.veiled).toEqual([""]);
		expect(actor.system.content.excluded).toEqual([]);
	});

	it("persists what is typed into an entry, through the change router", async () => {
		const { sheet, actor } = makeSheet();
		await sheet.actor.typedActor.addContentItem("excluded");
		const root = await render(sheet, true);

		const field = entries(sectionFor(root, "excluded"))[0];
		field.value = "Harm to children, on screen";
		field.dispatchEvent(new Event("change", { bubbles: true }));
		await Promise.resolve();

		expect(actor.system.content.excluded).toEqual(["Harm to children, on screen"]);
	});

	it("removes the entry the control names, leaving its neighbours", async () => {
		const { sheet, actor } = makeSheet();
		const typed = sheet.actor.typedActor;
		await typed.addContentItem("excluded");
		await typed.addContentItem("excluded");
		await typed.updateContentItem("excluded", 0, "Sexual violence");
		await typed.updateContentItem("excluded", 1, "Harm to children, on screen");
		const root = await render(sheet, true);

		const remove = sectionFor(root, "excluded").querySelectorAll(".stonetop-content-item-remove")[0];
		await act(sheet, "removeContentItem", remove, { type: "contextmenu" });

		expect(actor.system.content.excluded).toEqual(["Harm to children, on screen"]);
	});

	// An entry is a phrase people keep editing, so the caret has to survive the re-render every edit
	// causes — which it only does if the row carries something that identifies it uniquely on a tab
	// holding three lists that all number their rows from zero.
	it("identifies a row by its section and its place in it", async () => {
		const { sheet } = makeSheet();
		await sheet.actor.typedActor.addContentItem("veiled");
		const root = await render(sheet, true);

		const field = entries(sectionFor(root, "veiled"))[0];
		expect(field.dataset.slug).toBe("veiled");
		expect(field.dataset.index).toBe("0");
	});

	// The tab's ARIA moves as one thing: the panel is named by the button that selects it, and core's
	// changeTab finds the panel by the same data-tab the button carries.
	it("keeps the tab, its panel and the name that ties them together in step", async () => {
		const root = await render(makeSheet().sheet, true);
		const button = root.querySelector('[role="tab"][data-tab="content"]');

		expect(button.getAttribute("aria-controls")).toBe(panel(root).id);
		expect(panel(root).getAttribute("aria-labelledby")).toBe(button.id);
		expect(panel(root).getAttribute("role")).toBe("tabpanel");
	});
});
