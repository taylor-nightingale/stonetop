// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createStonetopCharacterSheetClass } from "../../../src/actors/character/StonetopCharacterSheet.js";
import { StonetopCharacter } from "../../../src/actors/character/StonetopCharacter.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { FakeRepositoryFactory } from "../../fakes/FakeRepositoryFactory.js";
import { FakeGameBuilder } from "../../fakes/FakeGameBuilder.js";
import { FakeCompendiumMoveBuilder } from "../../fakes/FakeCompendiumMoveBuilder.js";
import { TestPlaybookItemBuilder } from "../../fakes/TestPlaybookItemBuilder.js";
import { renderTemplate } from "../../fakes/renderTemplate.js";
import { OpenDisclosures } from "../../../src/utils/OpenDisclosures.js";
import { withCategoryFields } from "../../../src/actors/embeddedMoves.js";
import { fire, settle } from "../../fakes/domEvents.js";

// The Seeker's backgrounds make you Well Versed in a topic, end to end: the whole sheet template, the
// real character, the background radios and the Witch Hunter's topic pick pressed through the sheet's
// own wiring, and the mark read back off the Well Versed move item.

const TOPICS = { slug: "topics", list: [
	{ type: "entry", slug: "last-door",    track: { max: 1 }, content: { title: null, text: "The Last Door, death, and the undead" } },
	{ type: "entry", slug: "fae",          track: { max: 1 }, content: { title: null, text: "The Fae and their strange ways" } },
	{ type: "entry", slug: "makers",       track: { max: 1 }, content: { title: null, text: "The Makers and their arts" } },
	{ type: "entry", slug: "things-below", track: { max: 1 }, content: { title: null, text: "The Things Below" } },
] };

const mark = options => [{ move: "well-versed", group: "topics", options }];

const playbookItem = () => new TestPlaybookItemBuilder()
	.withSlug("the-seeker").withName("The Seeker")
	.withBackgrounds([
		{ slug: "patriot",      label: "Patriot",      description: "Well Versed in the Things Below.", moveMarks: mark(["things-below"]) },
		{ slug: "antiquarian",  label: "Antiquarian",  description: "Well Versed in the Makers.",       moveMarks: mark(["makers"]) },
		{ slug: "witch-hunter", label: "Witch Hunter", description: "Well Versed in (pick 1).",
		  moveMarks: mark(["fae", "things-below", "last-door"]) },
	])
	.build();

function wellVersedItem() {
	const move = new FakeCompendiumMoveBuilder().withName("Well Versed").withRepeatMax(3).withChoices(TOPICS).build();
	return { ...withCategoryFields(move, "playbook-the-seeker", true), _id: "wv" };
}

function makeSheet() {
	new FakeGameBuilder().build();
	const actor = new FakeCharacterActorBuilder()
		.withPlaybook("the-seeker").withItems([playbookItem(), wellVersedItem()])
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
	};
	return { sheet: new (createStonetopCharacterSheetClass(Base))(), actor };
}

async function render(sheet) {
	const context = await sheet._prepareContext({});
	sheet.element.innerHTML = renderTemplate("systems/stonetop/templates/actor/character.hbs", context);
	document.body.replaceChildren(sheet.element);
	sheet.openDisclosures.restore(sheet.element);
	if (!sheet._wired) { await sheet._onFirstRender(context, {}); sheet._wired = true; }
	return sheet.element;
}

const backgrounds = root => root.querySelector('.tab[data-tab="playbook"] [data-section="background"] .stonetop-section-choose');
const tick = async el => { el.checked = true; fire(el, "change"); await settle(); };
const chooseBackground = async (sheet, slug) =>
	tick(backgrounds(await render(sheet)).querySelector(`input[data-change-action="selectBackground"][value="${slug}"]`));
const pickTopic = async (sheet, option) =>
	tick(backgrounds(await render(sheet)).querySelector(`input[data-cg-group="witch-hunter-well-versed"][data-cg-option="${option}"]`));
const topics = actor => actor.items.get("wv").system.pickValues?.topics ?? {};
const marked = actor => Object.entries(topics(actor)).filter(([, n]) => n > 0).map(([slug]) => slug);

beforeEach(() => { document.body.innerHTML = ""; });

describe("Well Versed topics from the Seeker's background (integration)", () => {
	it("offers the Witch Hunter's three topics while choosing, worded as Well Versed words them", async () => {
		const root = await render(makeSheet().sheet);
		const picks = backgrounds(root).querySelectorAll('input[data-cg-group="witch-hunter-well-versed"]');
		expect([...picks].map(p => p.dataset.cgOption)).toEqual(["fae", "things-below", "last-door"]);
		expect([...picks].every(p => p.type === "radio")).toBe(true);
		expect(backgrounds(root).textContent).toContain("The Fae and their strange ways");
	});

	it("marks the Patriot's topic on Well Versed when the Patriot is chosen", async () => {
		const { sheet, actor } = makeSheet();
		await chooseBackground(sheet, "patriot");
		expect(marked(actor)).toEqual(["things-below"]);
	});

	it("moves the mark to the Antiquarian's topic on switching", async () => {
		const { sheet, actor } = makeSheet();
		await chooseBackground(sheet, "patriot");
		await chooseBackground(sheet, "antiquarian");
		expect(marked(actor)).toEqual(["makers"]);
	});

	it("marks the topic the Witch Hunter picks, and moves it when the pick changes", async () => {
		const { sheet, actor } = makeSheet();
		await chooseBackground(sheet, "witch-hunter");
		expect(marked(actor)).toEqual([]);

		await pickTopic(sheet, "fae");
		expect(marked(actor)).toEqual(["fae"]);

		await pickTopic(sheet, "last-door");
		expect(marked(actor)).toEqual(["last-door"]);
	});

	it("marks a topic picked before the Witch Hunter was chosen once it is", async () => {
		const { sheet, actor } = makeSheet();
		await chooseBackground(sheet, "patriot");
		await pickTopic(sheet, "fae");
		expect(marked(actor)).toEqual(["things-below"]);

		await chooseBackground(sheet, "witch-hunter");
		expect(marked(actor)).toEqual(["fae"]);
	});

	it("lets the topics be ticked on Well Versed itself", async () => {
		const { actor } = makeSheet();
		await actor.typedActor.setChoiceCountFor(
			{ context: "move", moveSlug: "well-versed", group: "topics", option: "fae" }, 1);
		expect(marked(actor)).toEqual(["fae"]);
	});
});
