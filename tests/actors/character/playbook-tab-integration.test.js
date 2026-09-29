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
import { fire, settle } from "../../fakes/domEvents.js";

// The Playbook tab, end to end (D11): real playbook item, real character, the whole sheet template,
// pressed and changed through the sheet's own actions and wiring. Every section rests on what was
// chosen and opens from its own door; opening everything is an event — a playbook arriving — and a
// route opens the section it points at.

const playbookItem = () => new TestPlaybookItemBuilder()
	.withSlug("the-fox").withName("The Fox")
	.withBackgrounds([
		{ slug: "the-natural",   label: "The Natural",   description: "You grew up around here." },
		{ slug: "the-scoundrel", label: "The Scoundrel", description: "You never fit in.",
		  choices: { slug: "the-scoundrel", list: [
			{ type: "entry", slug: "cut-loose", content: { text: "You cut loose from your kin." }, track: { max: 1 } },
		  ]}},
	])
	.withInstinct({ slug: "instinct", list: [{ type: "pick", pickCount: 1, options: [
		{ slug: "take", text: "To take what isn't yours" }, { slug: "prove", text: "To prove yourself" },
	]}]})
	.withAppearance({ slug: "appearance", list: [{ type: "pick", pickCount: 1, inline: true, options: [
		{ slug: "young-pup", text: "young pup" }, { slug: "old-timer", text: "cagey old-timer" },
	]}]})
	.withChoices([{ slug: "tall-tales", list: [
		{ type: "entry", content: { title: "There Was That Time You…", text: "Mix and match." } },
		{ type: "entry", slug: "great-wood", content: { text: "… got lost in the Great Wood." }, track: { max: 1 } },
		{ type: "entry", slug: "the-flats",  content: { text: "… got lost in the Flats." },      track: { max: 1 } },
	]}])
	.withOrigin([{ region: "Stonetop", names: ["Bhelu"] }, { region: "Gordin's Delve", names: [] }])
	.withIntroductions({ step3: "Describe your knives.", step4: { slug: "intro-npc", list: [
		{ type: "entry", slug: "favour", content: { text: "Who do you owe a favour?" }, input: { type: "inline" } },
	]}})
	.build();

function makeSheet({ playbook = true } = {}) {
	new FakeGameBuilder().build();
	const actor = new FakeCharacterActorBuilder()
		.withPlaybook(playbook ? "the-fox" : "").withItems(playbook ? [playbookItem()] : [])
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

// A draw, as core does one: the context, the whole sheet, in the document, the reader's open
// regions put back, and the sheet's wiring once.
async function render(sheet) {
	const context = await sheet._prepareContext({});
	sheet.element.innerHTML = renderTemplate("systems/stonetop/templates/actor/character.hbs", context);
	document.body.replaceChildren(sheet.element);
	sheet.openDisclosures.restore(sheet.element);
	if (!sheet._wired) { await sheet._onFirstRender(context, {}); sheet._wired = true; }
	return sheet.element;
}

const tab = root => root.querySelector('.tab[data-tab="playbook"]');
const section = (root, key) => tab(root).querySelector(`[data-section="${key}"]`);
const door = (root, key) => section(root, key).querySelector(".stonetop-section-door");
const choosing = (root, key) => !section(root, key).querySelector(".stonetop-section-choose").hidden;
const resting = (root, key) => section(root, key).querySelector(".stonetop-section-rest");
const press = async (sheet, target) => {
	await sheet.constructor.DEFAULT_OPTIONS.actions[target.dataset.action].call(sheet, new Event("click"), target);
	await settle();
};
const tick = async el => { el.checked = true; fire(el, "change"); await settle(); };

beforeEach(() => { document.body.innerHTML = ""; });

describe("the Playbook tab's sections (integration)", () => {
	it("rests every section, each with a door saying Choose while nothing is chosen", async () => {
		const root = await render(makeSheet().sheet);
		for (const key of ["background", "instinct", "appearance", "origin", "lore-tall-tales"]) {
			expect(choosing(root, key), `${key} is open`).toBe(false);
			expect(door(root, key).textContent.trim()).toContain("stonetop.sheet.section.choose");
		}
		expect(door(root, "introductions").textContent).toContain("stonetop.sheet.section.open");
	});

	it("opens a section from its door onto everything on offer, and says Done", async () => {
		const { sheet } = makeSheet();
		const root = await render(sheet);
		await press(sheet, door(root, "instinct"));
		expect(choosing(root, "instinct")).toBe(true);
		expect(section(root, "instinct").querySelectorAll('.stonetop-cg-pick')).toHaveLength(2);
		expect(door(root, "instinct").querySelector("[data-disclosure-open]").hidden).toBe(false);
		expect(section(root, "instinct").querySelector(".stonetop-bar-note").hidden).toBe(false);
	});

	// Reported: "Change" hung on beside "Done" and the resting lines slid out under the choices coming
	// in. The door swaps the word and the bodies at once; only the panel's height eases.
	it("swaps the door's word and the section's bodies the moment the door is pressed", () => {
		const { sheet } = makeSheet();
		return render(sheet).then(root => {
			const target = door(root, "instinct");
			sheet.constructor.DEFAULT_OPTIONS.actions[target.dataset.action].call(sheet, new Event("click"), target);
			expect(target.querySelector("[data-disclosure-shut]").hidden).toBe(true);
			expect(target.querySelector("[data-disclosure-open]").hidden).toBe(false);
			expect(resting(root, "instinct").hidden).toBe(true);
			expect(choosing(root, "instinct")).toBe(true);
		});
	});

	it("keeps a section open across the render a choice in it causes, and reads the choice back once shut", async () => {
		const { sheet } = makeSheet();
		let root = await render(sheet);
		await press(sheet, door(root, "instinct"));
		await tick(section(root, "instinct").querySelector('.stonetop-cg-pick[data-cg-option="take"]'));
		root = await render(sheet);
		expect(choosing(root, "instinct")).toBe(true);

		await press(sheet, door(root, "instinct"));
		root = await render(sheet);
		expect(choosing(root, "instinct")).toBe(false);
		expect(resting(root, "instinct").textContent).toContain("To take what isn't yours");
		expect(door(root, "instinct").textContent).toContain("stonetop.sheet.section.change");
	});

	// Never hide options while choosing: every background shows its own picks, taken or not.
	it("shows every background with its own picks while choosing", async () => {
		const root = await render(makeSheet().sheet);
		const open = section(root, "background").querySelector(".stonetop-section-choose");
		expect(open.querySelectorAll('input[data-change-action="selectBackground"]')).toHaveLength(2);
		expect(open.textContent).toContain("You cut loose from your kin.");
	});

	it("rests the background on the one taken, its name no longer a radio", async () => {
		const { sheet } = makeSheet();
		let root = await render(sheet);
		await tick(section(root, "background").querySelector('input[value="the-natural"]'));
		root = await render(sheet);
		const rest = resting(root, "background");
		expect(rest.textContent).toContain("The Natural");
		expect(rest.textContent).not.toContain("The Scoundrel");
		expect(rest.querySelector("input")).toBeNull();
	});

	it("names a region with no names of its own, rather than leaving it empty", async () => {
		const root = await render(makeSheet().sheet);
		expect(section(root, "origin").querySelector(".stonetop-section-choose").textContent)
			.toContain("stonetop.sheet.playbook.noNames");
	});

	// The playbook's own story: its title moves to the bar and is not printed a second time.
	it("heads a lore section with its title on the bar, said once", async () => {
		const root = await render(makeSheet().sheet);
		const lore = section(root, "lore-tall-tales");
		expect(lore.querySelector(".stonetop-bar-title").textContent).toBe("There Was That Time You…");
		expect(lore.querySelector(".stonetop-section-choose").textContent).not.toContain("There Was That Time You…");
		expect(lore.querySelector(".stonetop-section-choose").textContent).toContain("Mix and match.");
	});

	it("sets the background in one column and the instinct, appearance and origin in the other", async () => {
		const root = await render(makeSheet().sheet);
		const [left, right] = tab(root).querySelectorAll(".stonetop-section-column");
		const keys = col => [...col.querySelectorAll("[data-section]")].map(s => s.dataset.section);
		expect(keys(left)).toEqual(["background"]);
		expect(keys(right)).toEqual(["instinct", "appearance", "origin"]);
	});

	it("has no lock", async () => {
		const root = await render(makeSheet().sheet);
		expect(tab(root).querySelector('[data-view-flag="playbookLocked"]')).toBeNull();
		expect(tab(root).classList.contains("is-locked")).toBe(false);
	});
});

describe("opening sections from elsewhere (integration)", () => {
	it("opens every section when a playbook is chosen", async () => {
		const { sheet } = makeSheet({ playbook: false });
		let root = await render(sheet);
		await sheet.typedActor.applyDroppedItems([playbookItem()]);
		root = await render(sheet);
		for (const key of ["background", "instinct", "appearance", "origin", "lore-tall-tales", "introductions"])
			expect(choosing(root, key), `${key} did not open`).toBe(true);
	});

	it("opens nothing on a sheet that opens on a character who already has one", async () => {
		const root = await render(makeSheet().sheet);
		expect(choosing(root, "instinct")).toBe(false);
	});

	it("opens the instinct where the masthead's instinct lands", async () => {
		const { sheet } = makeSheet();
		let root = await render(sheet);
		await tick(section(root, "instinct").querySelector('.stonetop-cg-pick[data-cg-option="take"]'));
		root = await render(sheet);
		await press(sheet, root.querySelector(".stonetop-instinct .stonetop-goto"));
		expect(sheet.changeTab).toHaveBeenCalledWith("playbook", "primary");
		expect(choosing(root, "instinct")).toBe(true);
		root = await render(sheet);
		expect(choosing(root, "instinct")).toBe(true);
	});

	it("opens the instinct and the appearance where the level-up review lands", async () => {
		const { sheet } = makeSheet();
		const root = await render(sheet);
		const route = document.createElement("button");
		route.dataset.action = "goToTab";
		route.dataset.tab = "playbook";
		route.dataset.openSections = "instinct appearance";
		await press(sheet, route);
		expect([choosing(root, "instinct"), choosing(root, "appearance"), choosing(root, "origin")]).toEqual([true, true, false]);
	});
});

describe("a section at rest (integration)", () => {
	it("says what was chosen, and not the instruction for choosing it", async () => {
		const { sheet } = makeSheet();
		let root = await render(sheet);
		await tick(section(root, "instinct").querySelector('.stonetop-cg-pick[data-cg-option="take"]'));
		root = await render(sheet);
		expect(resting(root, "instinct").textContent).not.toContain("stonetop.character.selection.chooseOne");
	});
});
