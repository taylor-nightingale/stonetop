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

// The outfit adder, end to end: "+ add item" opens a panel hanging from the button, headed by the
// row the item will make; what is typed, stepped and tagged redraws that row; Add puts the item in
// the column with its ◇, its track of uses, its tags and its note. Real character, real template.

function makeSheet() {
	new FakeGameBuilder().build();
	globalThis.foundry ??= {};
	globalThis.foundry.applications ??= {};
	globalThis.foundry.applications.handlebars = { renderTemplate: async (path, data) => renderTemplate(path, data) };
	const actor = new FakeCharacterActorBuilder()
		.withPlaybook("the-fox").withItems([new TestPlaybookItemBuilder().withSlug("the-fox").withName("The Fox").build()])
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
	if (!sheet._wired) { await sheet._onFirstRender(context, {}); sheet._wired = true; }
	sheet._onRender(context, {});
	return sheet.element;
}

const press = async (sheet, target) => {
	const action = sheet.constructor.DEFAULT_OPTIONS.actions[target.dataset.action];
	await (action.handler ?? action).call(sheet, new MouseEvent("click", { button: 0 }), target);
	await settle();
};

const addButton = (root, column) => root.querySelector(`.stonetop-inv-add-btn[data-column="${column}"]`);
const adder = root => root.querySelector(".stonetop-outfit-adder");
const field = (root, name) => adder(root).querySelector(`[data-draft-field="${name}"]`);
const preview = root => adder(root).querySelector(".stonetop-outfit-adder-preview");
const type = async (root, name, value) => {
	const input = field(root, name);
	input.value = value;
	input.dispatchEvent(new Event("input", { bubbles: true }));
	await settle();
};

async function opened(column = "regular") {
	const made = makeSheet();
	let root = await render(made.sheet);
	await press(made.sheet, addButton(root, column));
	root = await render(made.sheet);
	return { ...made, root };
}

beforeEach(() => { document.body.innerHTML = ""; });

describe("the outfit adder (integration)", () => {
	it("is shut until asked for", async () => {
		const root = await render(makeSheet().sheet);
		expect(adder(root)).toBeNull();
		expect(addButton(root, "regular").getAttribute("aria-expanded")).toBe("false");
	});

	it("opens hanging from the button pressed, headed by the row it will make", async () => {
		const { root } = await opened();
		const button = addButton(root, "regular");
		expect(button.nextElementSibling).toBe(adder(root));
		expect(button.getAttribute("aria-expanded")).toBe("true");
		expect(preview(root).querySelector(".stonetop-inv-item")).not.toBeNull();
		expect(preview(root).hasAttribute("inert")).toBe(true);
		for (const name of ["name", "weight", "uses", "usesWord", "note"]) expect(field(root, name), name).not.toBeNull();
		expect(adder(root).querySelector(".stonetop-tags")).not.toBeNull();
		expect(document.activeElement).toBe(field(root, "name"));
	});

	// A small item carries a □ and no load, so there is no weight to set.
	it("has no weight in the small column, and previews a □", async () => {
		const { root } = await opened("small");
		expect(field(root, "weight")).toBeNull();
		expect(preview(root).querySelector(".stonetop-inv-square")).not.toBeNull();
	});

	it("redraws its row as the item is written", async () => {
		const { root } = await opened();
		await type(root, "name", "Naphtha");
		await type(root, "weight", "2");
		await type(root, "uses", "3");
		await type(root, "usesWord", "uses");
		await type(root, "note", "burns hot");
		const row = preview(root);
		expect(row.querySelector(".stonetop-inv-name").textContent).toBe("Naphtha");
		expect(row.querySelectorAll(".stonetop-inv-diamond")).toHaveLength(2);
		expect(row.querySelectorAll(".stonetop-inv-resource-btn")).toHaveLength(3);
		expect(row.textContent).toContain("uses");
		expect(row.querySelector(".stonetop-inv-note").textContent).toBe("burns hot");
	});

	it("steps the weight and uses from − and +", async () => {
		const { root, sheet } = await opened();
		adder(root).querySelector('[data-draft-step="weight"][data-step="1"]').click();
		adder(root).querySelector('[data-draft-step="uses"][data-step="1"]').click();
		await settle();
		expect(field(root, "weight").value).toBe("2");
		expect(preview(root).querySelectorAll(".stonetop-inv-diamond")).toHaveLength(2);
		expect(preview(root).querySelectorAll(".stonetop-inv-resource-btn")).toHaveLength(1);
		expect(sheet._outfitAdder.draft.uses).toBe(1);
	});

	// The follower cards' tag picker, typed into: the chip joins the adder, the tag the row.
	it("takes tags from the picker, and shows them on its row", async () => {
		const { sheet } = await opened();
		let root = sheet.element;
		const input = adder(root).querySelector(".stonetop-tag-add");
		input.value = "close";
		fire(input, "change");
		await settle();
		root = await render(sheet);
		expect([...adder(root).querySelectorAll(".stonetop-tag-chip")].map(c => c.dataset.tag)).toEqual(["close"]);
		expect(preview(root).querySelector(".stonetop-inv-parens")).not.toBeNull();

		await press(sheet, adder(root).querySelector('.stonetop-tag-chip[data-tag="close"]'));
		root = await render(sheet);
		expect(adder(root).querySelectorAll(".stonetop-tag-chip")).toHaveLength(0);
	});

	it("keeps what was typed through a render from elsewhere", async () => {
		const { root, sheet } = await opened();
		await type(root, "name", "Rope");
		const again = await render(sheet);
		expect(field(again, "name").value).toBe("Rope");
	});

	it("adds the item to its column with its ◇, uses, tags and note, and shuts", async () => {
		const { root, sheet, actor } = await opened();
		await type(root, "name", "Naphtha");
		await type(root, "uses", "3");
		await type(root, "usesWord", "uses");
		await type(root, "note", "burns hot");
		await sheet.toggleTag({ slug: null, field: "outfitDraftTags", memberIndex: null }, "thrown");
		await press(sheet, adder(await render(sheet)).querySelector('[data-action="outfitDraftAdd"]'));

		const item = actor.items.find(i => i.type === "outfitItem" && i.name === "Naphtha");
		expect(item.system).toMatchObject({
			inventoryColumn: "regular", weight: 1, tagList: ["thrown"], note: "burns hot",
			resource: { max: 3, title: null, labels: ["", "", "uses"] },
		});
		const after = await render(sheet);
		expect(adder(after)).toBeNull();
		const row = [...after.querySelectorAll(".stonetop-inventory-regular .stonetop-inv-item")]
			.find(r => r.querySelector(".stonetop-inv-name")?.textContent === "Naphtha");
		expect(row.querySelectorAll(".stonetop-inv-resource-btn")).toHaveLength(3);
	});

	it("adds on Enter in its name", async () => {
		const { root, actor } = await opened();
		await type(root, "name", "Rope");
		field(root, "name").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
		await settle();
		expect(actor.items.some(i => i.type === "outfitItem" && i.name === "Rope")).toBe(true);
	});

	it("adds nothing from Cancel, Escape, or a click elsewhere", async () => {
		const { root, sheet, actor } = await opened();
		await type(root, "name", "Rope");
		await press(sheet, adder(root).querySelector('[data-action="closeOutfitAdder"]'));
		expect(sheet._outfitAdder.isOpen).toBe(false);

		let again = await render(sheet);
		await press(sheet, addButton(again, "regular"));
		again = await render(sheet);
		field(again, "note").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
		await settle();
		expect(sheet._outfitAdder.isOpen).toBe(false);

		again = await render(sheet);
		await press(sheet, addButton(again, "regular"));
		again = await render(sheet);
		fire(again.querySelector(".sheet-body"), "click");
		await settle();
		expect(sheet._outfitAdder.isOpen).toBe(false);
		expect(actor.items.some(i => i.type === "outfitItem" && i.name === "Rope")).toBe(false);
	});
});
