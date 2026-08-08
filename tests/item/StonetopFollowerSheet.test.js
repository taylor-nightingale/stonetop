// @vitest-environment happy-dom
// happy-dom gives us a `document` — _onRender installs the global combobox handlers
// (activateComboBoxes), which addEventListener on document at install time.
import { describe, it, expect, vi } from "vitest";
import { createStonetopFollowerSheetClass } from "../../src/item/StonetopFollowerSheet.js";
import { FollowerSnapshot } from "../../src/model/snapshot/character/FollowerSnapshot.js";
import { fire } from "../fakes/domEvents.js";

// Drives the real sheet _prepareContext/_onRender (real buildFollowerSnapshot + helpers + the one
// enrichRichTextTree pass). Only the V2 ItemSheet base + the item document are mocked.

function makeItem(system = {}, { name = "Follower", img = "x.png" } = {}) {
	const item = {
		name, img,
		system: { companion: { enabled: false, catalog: [] }, ...system },
		getRollData: () => ({}),
		update: vi.fn(async patch => { foundry.utils.mergeObject(item.system, expandSystem(patch)); }),
	};
	return item;
}
// Apply a flat {"system.x.y": v} patch onto item.system for the update spy (good enough for tests).
function expandSystem(patch) {
	const out = {};
	for (const [k, v] of Object.entries(patch)) {
		if (k.startsWith("system.")) foundry.utils.setProperty(out, k.slice("system.".length), v);
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
	return new (createStonetopFollowerSheetClass(Base))();
}


describe("StonetopFollowerSheet._prepareContext", () => {
	it("builds an enriched follower-card preview from the item (view mode for a content follower)", async () => {
		const item = makeItem({ slug: "enfys", hp: { value: 4, max: 6 }, armor: "1", damage: "d6", loyalty: { value: 2, max: 3 } });
		const ctx = await makeSheet(item)._prepareContext({});
		expect(ctx.preview).toBeInstanceOf(FollowerSnapshot);
		expect(ctx.preview.name).toBe("Follower");
		expect(ctx.preview.hp).toBe(4);
		expect(ctx.preview.loyalty.current).toBe(2);
		expect(ctx.editMode).toBe(false);
	});

	it("opens a blank follower in the editor", async () => {
		const ctx = await makeSheet(makeItem({ slug: "x" }))._prepareContext({});
		expect(ctx.editMode).toBe(true);
	});

	it("stays view-only (editMode false) when not editable, even if blank", async () => {
		const ctx = await makeSheet(makeItem({ slug: "x" }), { editable: false })._prepareContext({});
		expect(ctx.editMode).toBe(false);
	});

	it("auto-generates a stable slug when missing", async () => {
		const item = makeItem({});
		delete item.system.slug;
		await makeSheet(item)._prepareContext({});
		expect(item.update).toHaveBeenCalledWith(expect.objectContaining({ "system.slug": expect.stringMatching(/^custom-follower-/) }));
	});

	it("normalizes the three Selection fields with the right multi + builds choiceRows", async () => {
		const item = makeItem({
			slug: "crew",
			tagList: { selected: ["group"], options: ["group", "brave"], multi: true, allowCustom: true },
			instinct: { selected: [], options: ["To lord over others"], multi: false, allowCustom: true },
			choices: [{ slug: "choices", list: [{ type: "pick", pickCount: 1, options: [{ slug: "a", text: "A" }] }] }],
		});
		const ctx = await makeSheet(item)._prepareContext({});
		expect(ctx.tagListSel.multi).toBe(true);
		expect(ctx.tagListSel.options).toEqual(["group", "brave"]);
		expect(ctx.instinctSel.multi).toBe(false);
		expect(ctx.hasChoices).toBe(true);
		expect(ctx.choiceRows.length).toBeGreaterThan(0);
	});
});

describe("StonetopFollowerSheet._onRender wiring", () => {
	// Seed the sheet's element with just the editor controls a test drives, then run the real
	// _onRender so the real bindAll wiring dispatches real DOM events into the real handlers.
	function wired(system, editorHtml) {
		const item = makeItem(system);
		const sheet = makeSheet(item);
		sheet.element.innerHTML = editorHtml;
		sheet._onRender({}, {});
		return { item, root: sheet.element };
	}

	it("member add writes the members array (at group max HP) AND ensures the group tag", () => {
		const { item, root } = wired(
			{ slug: "crew", hp: { value: 6, max: 6 }, members: [] },
			`<button class="follower-member-add"></button>`,
		);
		fire(root.querySelector(".follower-member-add"), "click");
		expect(item.update).toHaveBeenCalledWith({
			"system.members": [expect.objectContaining({ hp: { value: 6, max: 6 } })],
			"system.tagList": expect.objectContaining({ selected: ["group"], multi: true }),
		});
	});

	it("companion enable toggles the whole companion object", () => {
		const { item, root } = wired(
			{ slug: "x" },
			`<input type="checkbox" class="follower-companion-enable">`,
		);
		const box = root.querySelector(".follower-companion-enable");
		box.checked = true;
		fire(box, "change");
		expect(item.update).toHaveBeenCalledWith({ "system.companion": expect.objectContaining({ enabled: true }) });
	});

	it("editing a selection option saves a Selection raw for the field from the wrapper", () => {
		const { item, root } = wired(
			{ slug: "x", instinct: { selected: [], options: ["old"], multi: false, allowCustom: true } },
			`<div data-selection-field="instinct">
				<input class="follower-option-input" data-string-index="0">
			</div>`,
		);
		const input = root.querySelector(".follower-option-input");
		input.value = "new";
		fire(input, "change");
		expect(item.update).toHaveBeenCalledWith({ "system.instinct": expect.objectContaining({ options: ["new"], multi: false }) });
	});

	it("adding the choices group writes a fresh group at system.choices.0", () => {
		const { item, root } = wired({ slug: "x" }, `<button class="follower-choices-add"></button>`);
		fire(root.querySelector(".follower-choices-add"), "click");
		expect(item.update).toHaveBeenCalledWith({ "system.choices": [expect.objectContaining({ slug: "x" })] });
	});

	it("wires no editor handlers when the sheet is not editable", () => {
		const item = makeItem({ slug: "x" });
		const sheet = makeSheet(item, { editable: false });
		sheet.element.innerHTML = `<button class="follower-member-add"></button>`;
		sheet._onRender({}, {});
		fire(sheet.element.querySelector(".follower-member-add"), "click");
		expect(item.update).not.toHaveBeenCalled();
	});
});

describe("StonetopFollowerSheet toggleEditMode action", () => {
	it("flips mode and re-renders", async () => {
		const item = makeItem({ slug: "enfys", hp: { value: 4, max: 6 } });
		const sheet = makeSheet(item);
		await sheet._prepareContext({}); // content follower → opens in view
		const toggle = sheet.constructor.DEFAULT_OPTIONS.actions.toggleEditMode;

		toggle.call(sheet, new Event("click"), { dataset: { mode: "edit" } });
		expect(sheet.render).toHaveBeenCalledOnce();
		expect((await sheet._prepareContext({})).editMode).toBe(true);

		toggle.call(sheet, new Event("click"), { dataset: { mode: "view" } });
		expect((await sheet._prepareContext({})).editMode).toBe(false);
	});
});
