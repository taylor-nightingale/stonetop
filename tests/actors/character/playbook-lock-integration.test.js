// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createStonetopCharacterSheetClass } from "../../../src/actors/character/StonetopCharacterSheet.js";
import { StonetopCharacter } from "../../../src/actors/character/StonetopCharacter.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { FakeRepositoryFactory } from "../../fakes/FakeRepositoryFactory.js";
import { FakeGameBuilder } from "../../fakes/FakeGameBuilder.js";
import { TestPlaybookItemBuilder } from "../../fakes/TestPlaybookItemBuilder.js";
import { renderPartial } from "../../fakes/renderTemplate.js";
import { fire, settle } from "../../fakes/domEvents.js";

// The playbook tab's lock, end to end: choices made in the editor (real change events, real
// wiring, real StonetopCharacter) come back as the condensed lines. The unit tests prove the
// condenser picks the right things out of a group; these prove the tab keeps its own structure
// around them — locking swaps the CHOICE GROUPS for their condensed form and nothing else.

// A fresh item per sheet: choice values are written into the playbook item itself, so a shared one
// would carry one test's picks into the next.
const playbookItem = () => new TestPlaybookItemBuilder()
	.withSlug("the-fox")
	.withName("The Fox")
	.withBackgrounds([
		{ slug: "the-natural",   label: "The Natural",   description: "You grew up around here." },
		{ slug: "the-scoundrel", label: "The Scoundrel", description: "You never fit in." },
	])
	.withInstinct({ slug: "instinct", list: [
		{ type: "pick", pickCount: 1, options: [
			{ slug: "take", text: "To take what isn't yours" },
			{ slug: "prove", text: "To prove yourself" },
		]},
	]})
	.withAppearance({ slug: "appearance", list: [
		{ type: "pick", pickCount: 1, inline: true, options: [
			{ slug: "young-pup", text: "young pup" },
			{ slug: "old-timer", text: "cagey old-timer" },
		]},
	]})
	.withChoices([{ slug: "tall-tales", list: [
		{ type: "entry", content: { title: "There Was That Time You…", text: "Mix and match." } },
		{ type: "entry", slug: "great-wood", content: { text: "… got lost in the Great Wood." }, track: { max: 1 } },
		{ type: "entry", slug: "the-flats",  content: { text: "… got lost in the Flats." },      track: { max: 1 } },
	]}])
	.withOrigin([{ region: "Stonetop", names: ["Bhelu"] }, { region: "Marshedge", names: ["Ottar"] }])
	.withIntroductions({ step3: "Describe your knives.", step4: { slug: "intro-npc", list: [
		{ type: "entry", slug: "favour", content: { text: "Who do you owe a favour?" }, input: { type: "inline" } },
		{ type: "entry", slug: "feud",   content: { text: "Who do you feud with?" },    input: { type: "inline" } },
	]}})
	.build();

function makeSheet() {
	new FakeGameBuilder().build();
	const actor = new FakeCharacterActorBuilder()
		.withPlaybook("the-fox")
		.withItems([playbookItem()])
		.withTypedActor(a => new StonetopCharacter(a, new FakeRepositoryFactory()))
		.build();
	const Base = class {
		tabGroups = {};
		element = document.createElement("form");
		_editable = true;
		render = vi.fn();
		get actor() { return actor; }
		get typedActor() { return actor.typedActor; }
		get isEditable() { return this._editable; }
		_getTabsConfig(group) { return this.constructor.TABS[group] ?? null; }
		async _prepareContext() {
			return { tabs: {}, actor, editable: true, stonetop: await actor.typedActor.buildSnapshot() };
		}
		async _onFirstRender() {}
		_onRender() {}
	};
	return new (createStonetopCharacterSheetClass(Base))();
}

// Render the tab into the sheet's element and wire it exactly as a first render does.
async function renderTab(sheet) {
	const context = await sheet._prepareContext({});
	sheet.element.innerHTML = renderPartial("stonetop.tab-playbook", context);
	await sheet._onFirstRender(context, {});
	return sheet.element;
}

const tick = async (el) => { el.checked = true; fire(el, "change"); await settle(); };
const write = async (el, value) => { el.value = value; fire(el, "change"); await settle(); };

async function lockedHtml(sheet) {
	const def = sheet.constructor.DEFAULT_OPTIONS.actions.togglePlaybookLock;
	await def.call(sheet, { type: "click", button: 0 }, null);
	const context = await sheet._prepareContext({});
	return renderPartial("stonetop.tab-playbook", context);
}

beforeEach(() => { document.body.innerHTML = ""; });

describe("playbook lock (integration)", () => {
	it("condenses the choices made in the editor and drops everything else", async () => {
		const sheet = makeSheet();
		const tab = await renderTab(sheet);

		await tick(tab.querySelector(`input[data-change-action="selectBackground"][value="the-natural"]`));
		await tick(tab.querySelector(`input[data-change-action="selectOrigin"][value="Stonetop"]`));
		await tick(tab.querySelector(`.stonetop-cg-pick[data-cg-option="take"]`));
		await tick(tab.querySelector(`.stonetop-cg-pick[data-cg-option="young-pup"]`));
		await tick(tab.querySelector(`.stonetop-cg-track[data-cg-option="great-wood"]`));

		const html = await lockedHtml(sheet);

		expect(html).toContain("The Natural");
		expect(html).toContain("You grew up around here.");
		expect(html).toContain("To take what isn't yours");
		expect(html).toContain("young pup");
		expect(html).toContain("Stonetop");
		expect(html).toContain("There Was That Time You…");
		expect(html).toContain("Mix and match.");           // the group's own prose comes along
		expect(html).toContain("… got lost in the Great Wood.");

		// The options not taken, inside the groups, are gone.
		expect(html).not.toContain("cagey old-timer");
		expect(html).not.toContain("… got lost in the Flats.");
		expect(html).not.toContain("To prove yourself");
	});

	// The tab is unchanged apart from the groups: same sections, same order, same headings — so a
	// locked group can't drift out of the column or lose the separators around it.
	it("keeps the tab's own structure, condensing only the choice groups", async () => {
		const sheet = makeSheet();
		const tab = await renderTab(sheet);
		await tick(tab.querySelector(`.stonetop-cg-track[data-cg-option="great-wood"]`));

		const unlocked = renderPartial("stonetop.tab-playbook", await sheet._prepareContext({}));
		const html = await lockedHtml(sheet);

		// The tab's own sections still render, in the order the editor puts them in.
		for (const heading of ["background.label", "instinct.label", "appearance.label", "origin.label"])
			expect(html).toContain(heading);
		expect(html.indexOf("There Was That Time You…")).toBeLessThan(html.indexOf("background.label"));
		expect(unlocked).toContain(`class="stonetop-playbook-columns"`);
		expect(html).toContain(`class="stonetop-playbook-columns"`);

		// The group itself is condensed: the editor's row classes, with a tick where the box was.
		expect(html).toContain("stonetop-choice-tick");
		expect(html).toContain(`class="stonetop-choice-track stonetop-row"`);
		expect(html).not.toContain("stonetop-cg-track");
	});

	it("drops a group's prose along with the group when nothing under it was ticked", async () => {
		const sheet = makeSheet();
		const tab = await renderTab(sheet);
		await tick(tab.querySelector(`input[data-change-action="selectBackground"][value="the-natural"]`));

		const html = await lockedHtml(sheet);

		expect(html).toContain("The Natural");
		expect(html).not.toContain("There Was That Time You…");
		expect(html).not.toContain("Mix and match.");
	});

	// Background and origin are option lists rather than choice groups, so they need their own
	// locked branch — without it the tab keeps offering every path not taken.
	it("keeps only the chosen background and origin, without their radios", async () => {
		const sheet = makeSheet();
		const tab = await renderTab(sheet);
		await tick(tab.querySelector(`input[data-change-action="selectBackground"][value="the-natural"]`));
		await tick(tab.querySelector(`input[data-change-action="selectOrigin"][value="Stonetop"]`));

		const html = await lockedHtml(sheet);

		expect(html).toContain("The Natural");
		expect(html).toContain("You grew up around here.");
		expect(html).toContain("Stonetop");
		expect(html).not.toContain("The Scoundrel");
		expect(html).not.toContain("You never fit in.");
		expect(html).not.toContain("Marshedge");
		expect(html).not.toContain("Bhelu");                      // the suggested names, not a choice
		expect(html).not.toContain(`data-change-action="selectBackground"`);
		expect(html).not.toContain(`data-change-action="selectOrigin"`);
	});

	// The eight introduction steps are instructions for a thing you do once; locked, only the
	// answers are worth the room.
	it("collapses the introductions to the questions that were answered", async () => {
		const sheet = makeSheet();
		const tab = await renderTab(sheet);
		await write(tab.querySelector(`.stonetop-cg-text[data-cg-option="favour-input"]`), "Bhelu");

		const html = await lockedHtml(sheet);

		expect(html).toContain("introductions.title");
		expect(html).toContain("Who do you owe a favour?");
		expect(html).toContain("Bhelu");
		expect(html).not.toContain("Who do you feud with?");     // never answered
		expect(html).not.toContain("introductions.step1");       // the instructions are done with
		expect(html).not.toContain("introductions.preamble");
		expect(html).not.toContain("stonetop-intro-step");
	});

	it("keeps the toggle itself, so the summary can be unlocked again", async () => {
		const sheet = makeSheet();
		await renderTab(sheet);
		const html = await lockedHtml(sheet);
		expect(html).toContain(`data-action="togglePlaybookLock"`);
		expect(html).toContain("data-view-state");
	});

	it("unlocking brings the group's rows back", async () => {
		const sheet = makeSheet();
		await renderTab(sheet);
		await lockedHtml(sheet);
		const html = await lockedHtml(sheet);
		expect(html).toContain("stonetop-cg-track");
		expect(html).not.toContain("stonetop-choice-tick");
	});
});
