// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { createStonetopOutfitItemSheetClass } from "../../src/item/StonetopOutfitItemSheet.js";
import { OutfitItemSnapshot } from "../../src/model/snapshot/character/InventorySnapshot.js";

// Drives the real sheet _prepareContext (slug seeding, preview snapshot, view/edit mode), the
// toggleEditMode action, and the _onRender resource/armor wiring. Only the V2 ItemSheet base + the
// item document are mocked.

function makeItem(system = {}, { name = "Shield", img = "x.png" } = {}) {
	const item = {
		name, img,
		system: { ...system },
		getRollData: () => ({}),
		update: vi.fn(async patch => { Object.assign(item.system, expandSystem(patch)); }),
	};
	return item;
}
// Apply a flat {"system.x": v} patch onto item.system for the update spy.
function expandSystem(patch) {
	const out = {};
	for (const [k, v] of Object.entries(patch)) {
		if (k.startsWith("system.")) out[k.slice("system.".length)] = v;
	}
	return out;
}

function makeSheet(item, { editable = true } = {}) {
	const Base = class {
		get item() { return item; }
		get isEditable() { return editable; }
		async _prepareContext() { return {}; }
		_onRender() {}
		element = document.createElement("form");
		render = vi.fn();
	};
	return new (createStonetopOutfitItemSheetClass(Base))();
}

const SHIELD = {
	slug: "shield", inventoryColumn: "regular", weight: 2, tagList: "",
	note: "+1 armor, +1 Readiness on 7+ to Defend", resource: null, twoCol: false,
	armor: { modifier: 1 },
};

describe("StonetopOutfitItemSheet._prepareContext", () => {
	it("seeds a stable slug for a blank item", async () => {
		const item = makeItem();
		await makeSheet(item)._prepareContext({});
		expect(item.update).toHaveBeenCalledOnce();
		// Not name-derived: inventory checked-state and resource pips are keyed by slug, so a rename
		// must not orphan a character's state.
		expect(item.system.slug).toMatch(/^custom-outfit-/);
	});

	it("preserves an existing slug", async () => {
		const item = makeItem(SHIELD);
		const ctx  = await makeSheet(item)._prepareContext({});
		expect(item.update).not.toHaveBeenCalled();
		expect(ctx.system.slug).toBe("shield");
	});

	it("never writes to a locked (non-editable) item", async () => {
		const item = makeItem();
		await makeSheet(item, { editable: false })._prepareContext({});
		expect(item.update).not.toHaveBeenCalled();
	});

	it("builds the preview as the OutfitItemSnapshot the inventory row renders", async () => {
		const item = makeItem({ ...SHIELD, tagList: "close, area" });
		const ctx  = await makeSheet(item)._prepareContext({});
		expect(ctx.preview).toBeInstanceOf(OutfitItemSnapshot);
		expect(ctx.preview.slug).toBe("shield");
		expect(ctx.preview.name).toBe("Shield");
		expect(ctx.preview.weight).toBe(2);
		expect(ctx.preview.tags.raw).toBe("close, area");
		expect(ctx.preview.note.raw).toBe("+1 armor, +1 Readiness on 7+ to Defend");
		// A catalog item carries no per-character state: unchecked, and not deletable-as-custom.
		expect(ctx.preview.checked).toBe(false);
		expect(ctx.preview.isCustom).toBe(false);
	});

	it("previews a resource track empty (the pips belong to a character, not the catalog item)", async () => {
		const item = makeItem({ ...SHIELD, resource: { max: 3, title: null, labels: ["", "", "hours"] } });
		const ctx  = await makeSheet(item)._prepareContext({});
		expect(ctx.preview.resource.max).toBe(3);
		expect(ctx.preview.resource.current).toBe(0);
		expect(ctx.preview.resource.labels).toEqual(["", "", "hours"]);
	});

	it("previews no resource when the item has none", async () => {
		const ctx = await makeSheet(makeItem(SHIELD))._prepareContext({});
		expect(ctx.preview.resource).toBeNull();
	});

	it("exposes the item and editability for the template", async () => {
		const item = makeItem(SHIELD);
		const ctx  = await makeSheet(item)._prepareContext({});
		expect(ctx.item).toBe(item);
		expect(ctx.editable).toBe(true);
	});
});

describe("StonetopOutfitItemSheet — view/edit mode", () => {
	it("opens an authored item in the rendered view", async () => {
		const ctx = await makeSheet(makeItem(SHIELD))._prepareContext({});
		expect(ctx.editMode).toBe(false);
	});

	it("opens a brand-new item in the editor", async () => {
		const ctx = await makeSheet(makeItem())._prepareContext({});
		expect(ctx.editMode).toBe(true);
	});

	it("forces view-only for a locked (non-editable) item", async () => {
		const ctx = await makeSheet(makeItem(), { editable: false })._prepareContext({});
		expect(ctx.editMode).toBe(false);
	});

	it("the toggleEditMode action flips mode and re-renders", async () => {
		const sheet = makeSheet(makeItem(SHIELD));
		await sheet._prepareContext({});     // opens in view (authored)
		const toggle = sheet.constructor.DEFAULT_OPTIONS.actions.toggleEditMode;

		toggle.call(sheet, new Event("click"), { dataset: { mode: "edit" } });
		expect(sheet.render).toHaveBeenCalledOnce();
		expect((await sheet._prepareContext({})).editMode).toBe(true);

		toggle.call(sheet, new Event("click"), { dataset: { mode: "view" } });
		expect((await sheet._prepareContext({})).editMode).toBe(false);
	});
});

describe("StonetopOutfitItemSheet._onRender — resource wiring", () => {
	const RESOURCE_HTML = `
		<button class="arcanum-resource-toggle" data-path="system.resource"></button>
		<input class="arcanum-resource-labels" data-path="system.resource">`;

	it("adds a blank resource when toggled on", () => {
		const item  = makeItem(SHIELD);
		const sheet = makeSheet(item);
		sheet.element.innerHTML = RESOURCE_HTML;
		sheet._onRender({}, {});

		sheet.element.querySelector(".arcanum-resource-toggle").click();
		expect(item.update).toHaveBeenCalledWith({ "system.resource": { max: 1, maxStat: null, title: null, labels: [] } });
	});

	it("removes the resource when toggled off", () => {
		const item  = makeItem({ ...SHIELD, resource: { max: 3, labels: [] } });
		const sheet = makeSheet(item);
		sheet.element.innerHTML = RESOURCE_HTML;
		sheet._onRender({}, {});

		sheet.element.querySelector(".arcanum-resource-toggle").click();
		expect(item.update).toHaveBeenCalledWith({ "system.resource": null });
	});

	it("splits comma-separated pip labels", () => {
		const item  = makeItem({ ...SHIELD, resource: { max: 3, labels: [] } });
		const sheet = makeSheet(item);
		sheet.element.innerHTML = RESOURCE_HTML;
		sheet._onRender({}, {});

		const input = sheet.element.querySelector(".arcanum-resource-labels");
		input.value = " , , hours";
		input.dispatchEvent(new Event("change"));
		expect(item.update).toHaveBeenCalledWith({ "system.resource.labels": ["hours"] });
	});
});

describe("StonetopOutfitItemSheet._onRender — armor wiring", () => {
	const ARMOR_HTML = `
		<button class="outfit-armor-toggle"></button>
		<input class="outfit-armor-field" data-field="base">
		<input class="outfit-armor-field" data-field="modifier">`;

	function armorSheet(system) {
		const item  = makeItem(system);
		const sheet = makeSheet(item);
		sheet.element.innerHTML = ARMOR_HTML;
		sheet._onRender({}, {});
		return { item, sheet };
	}

	it("adds a blank armor block when toggled on", () => {
		const { item, sheet } = armorSheet({ ...SHIELD, armor: null });
		sheet.element.querySelector(".outfit-armor-toggle").click();
		expect(item.update).toHaveBeenCalledWith({ "system.armor": { base: null, modifier: null } });
	});

	it("removes the armor block when toggled off", () => {
		const { item, sheet } = armorSheet(SHIELD);
		sheet.element.querySelector(".outfit-armor-toggle").click();
		expect(item.update).toHaveBeenCalledWith({ "system.armor": null });
	});

	it("writes the whole armor object so the sibling field survives", () => {
		const { item, sheet } = armorSheet({ ...SHIELD, armor: { base: 1, modifier: null } });
		const modifier = sheet.element.querySelector('[data-field="modifier"]');
		modifier.value = "2";
		modifier.dispatchEvent(new Event("change"));
		expect(item.update).toHaveBeenCalledWith({ "system.armor": { base: 1, modifier: 2 } });
	});

	it("stores an emptied field as null, not 0 — CharacterInventory.calculateArmor counts any non-null", () => {
		const { item, sheet } = armorSheet({ ...SHIELD, armor: { base: 1, modifier: 2 } });
		const base = sheet.element.querySelector('[data-field="base"]');
		base.value = "";
		base.dispatchEvent(new Event("change"));
		expect(item.update).toHaveBeenCalledWith({ "system.armor": { base: null, modifier: 2 } });
	});

	it("wires nothing when the sheet is not editable", () => {
		const item  = makeItem(SHIELD);
		const sheet = makeSheet(item, { editable: false });
		sheet.element.innerHTML = ARMOR_HTML;
		sheet._onRender({}, {});

		sheet.element.querySelector(".outfit-armor-toggle").click();
		expect(item.update).not.toHaveBeenCalled();
	});
});
