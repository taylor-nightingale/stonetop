// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createStonetopCharacterSheetClass } from "../../../src/actors/character/StonetopCharacterSheet.js";
import { StonetopCharacter } from "../../../src/actors/character/StonetopCharacter.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { FakeRepositoryFactory } from "../../fakes/FakeRepositoryFactory.js";
import { FakeGameBuilder } from "../../fakes/FakeGameBuilder.js";
import { renderTemplate } from "../../fakes/renderTemplate.js";
import { OpenDisclosures } from "../../../src/utils/OpenDisclosures.js";
import { fire, settle } from "../../fakes/domEvents.js";

// The Possessions tab, end to end: the Moves tab's shape with a possession in each row. It rests on
// what the character has; its door opens the playbook's whole list, one box a row, the playbook's
// sentence on the bar. What the playbook hands over is boxed and cannot be cleared, and says so. A
// possession's options are always shown, beneath it.

const possession = (slug, name, { selected = false, preselected = false, extra = {}, stamped = true } = {}) => ({
	...(stamped ? { flags: { stonetop: { grant: { source: "playbook:the-blessed", key: `possession:${slug}` } } } } : {}),
	_id: `${slug}-item`, type: "possession", name,
	system: { slug, description: `${name}, described.`, resource: null, outfitItems: [], choices: null, scaling: null,
		selected, preselected, uses: 0, pickValues: {}, choiceUses: {}, ...extra },
});

const WEAPONS = {
	slug: "weapons-of-war",
	list: [{ type: "pick", pickCount: 1, options: [{ slug: "mace", text: "Mace" }, { slug: "crossbow", text: "Crossbow" }] }],
};

const ITEMS = () => [
	{ _id: "playbook-item", type: "playbook", name: "The Blessed",
	  system: { slug: "the-blessed", specialPossessions: { pickCount: 2, pickNote: "Pick 2, in addition to your sacred pouch",
		preselected: ["sacred-pouch"], slugs: ["sacred-pouch", "apiary", "weapons-of-war", "mastiffs"] } } },
	possession("sacred-pouch", "Sacred pouch", { selected: true, preselected: true }),
	possession("apiary", "Apiary"),
	possession("weapons-of-war", "Weapons of war", { selected: true, extra: { choices: WEAPONS, pickValues: { "weapons-of-war": { mace: 1 } } } }),
	possession("mastiffs", "Mastiffs"),
	possession("lucky-coin", "Lucky coin", { selected: true, stamped: false }),
];

function makeSheet() {
	new FakeGameBuilder().build();
	const actor = new FakeCharacterActorBuilder()
		.withPlaybook("the-blessed").withItems(ITEMS())
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
	sheet._onRender(context, {});
	return sheet.element;
}

const panel = root => root.querySelector('.tab[data-tab="possessions"] [data-section="possessions"]');
const rest = root => panel(root).querySelector(".stonetop-section-rest");
const choose = root => panel(root).querySelector(".stonetop-section-choose");
const slugs = region => [...region.querySelectorAll("li.stonetop-prow")].map(li => li.dataset.slug);
const row = (region, slug) => region.querySelector(`li.stonetop-prow[data-slug="${slug}"]`);
const door = root => panel(root).querySelector(".stonetop-section-door");
const press = async (sheet, target) => {
	await sheet.constructor.DEFAULT_OPTIONS.actions[target.dataset.action].call(sheet, new Event("click"), target);
	await settle();
};
const selected = (actor, slug) => actor.items.find(i => i.system?.slug === slug).system.selected;

beforeEach(() => { document.body.innerHTML = ""; });

describe("the Possessions tab (integration)", () => {
	it("rests on what the character has, with no boxes", async () => {
		const root = await render(makeSheet().sheet);
		expect(panel(root).querySelector(".stonetop-bar-title").textContent).toBe("stonetop.character.gear.specialPossessions");
		expect(slugs(rest(root))).toEqual(["sacred-pouch", "weapons-of-war", "lucky-coin"]);
		expect(rest(root).querySelector(".stonetop-possession-check")).toBeNull();
		expect(choose(root).hidden).toBe(true);
	});

	it("shows a possession's options beneath it at rest, and they still change", async () => {
		const { sheet, actor } = makeSheet();
		const root = await render(sheet);
		const options = row(rest(root), "weapons-of-war").querySelectorAll(".stonetop-cg-pick");
		expect(options).toHaveLength(2);
		expect(options[0].checked).toBe(true);
		options[1].checked = true;
		fire(options[1], "change");
		await settle();
		expect(actor.items.find(i => i.system?.slug === "weapons-of-war").system.pickValues["weapons-of-war"].crossbow).toBe(1);
	});

	it("opens onto the whole list, one box a row, with the playbook's sentence on the bar", async () => {
		const { sheet } = makeSheet();
		const root = await render(sheet);
		await press(sheet, door(root));
		expect(choose(root).hidden).toBe(false);
		expect(slugs(choose(root))).toEqual(["sacred-pouch", "apiary", "weapons-of-war", "mastiffs", "lucky-coin"]);
		expect([...choose(root).querySelectorAll(".stonetop-possession-check")].map(b => b.checked)).toEqual([true, false, true, false, true]);
		expect(panel(root).querySelector(".stonetop-bar-note").textContent).toBe("Pick 2, in addition to your sacred pouch");
	});

	it("keeps what the playbook hands over boxed, and says why", async () => {
		const { sheet } = makeSheet();
		const root = await render(sheet);
		await press(sheet, door(root));
		const pouch = row(choose(root), "sacred-pouch");
		expect(pouch.querySelector(".stonetop-possession-check").disabled).toBe(true);
		expect(pouch.querySelector(".stonetop-mrow-choosing").textContent).toContain("stonetop.character.gear.fromPlaybook");
		expect(row(choose(root), "apiary").querySelector(".stonetop-mrow-choosing")).toBeNull();
	});

	it("takes a possession from its box, and stays open across the render", async () => {
		const { sheet, actor } = makeSheet();
		let root = await render(sheet);
		await press(sheet, door(root));
		const box = row(choose(root), "apiary").querySelector(".stonetop-possession-check");
		box.checked = true;
		fire(box, "change");
		await settle();
		expect(selected(actor, "apiary")).toBe(true);
		root = await render(sheet);
		expect(choose(root).hidden).toBe(false);
	});

	it("names the two copies of an option apart, so checking one never clears the other", async () => {
		const root = await render(makeSheet().sheet);
		const name = region => row(region, "weapons-of-war").querySelector(".stonetop-cg-pick").name;
		expect(name(rest(root))).not.toBe(name(choose(root)));
	});

	it("says what is still to pick, with the door's Choose, until nothing is", async () => {
		const { sheet } = makeSheet();
		const root = await render(sheet);
		const owed = panel(root).querySelector(".stonetop-owing");
		expect(owed.textContent).toContain("1 still to pick");
		await press(sheet, owed.querySelector("[data-action]"));
		expect(choose(root).hidden).toBe(false);
	});

	it("removes a possession dropped on, from its row", async () => {
		const root = await render(makeSheet().sheet);
		expect(row(rest(root), "lucky-coin").querySelector('[data-action="deletePossession"]')).not.toBeNull();
		expect(row(rest(root), "weapons-of-war").querySelector('[data-action="deletePossession"]')).toBeNull();
	});
});
