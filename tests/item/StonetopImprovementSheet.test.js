// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { createStonetopImprovementSheetClass } from "../../src/item/StonetopImprovementSheet.js";
import { ChoiceGroup } from "../../src/model/snapshot/character/ChoiceGroup.js";
import { ImprovementPayoff } from "../../src/model/snapshot/steading/ImprovementPayoff.js";

// Drives the real sheet _prepareContext (slug/group seeding, preview snapshot, view/edit mode), the
// toggleEditMode action, and the _onRender editor wiring. Only the V2 ItemSheet base + the item
// document are mocked.

function makeItem(system = {}, { name = "Improvement", img = "x.png" } = {}) {
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
	return new (createStonetopImprovementSheetClass(Base))();
}

const WATCHTOWER = {
	slug: "watchtower",
	list: [{ type: "entry", slug: "built", content: { title: "Watchtower", text: "Keep the watch." }, track: { max: 2 } }],
};

describe("StonetopImprovementSheet._prepareContext", () => {
	it("seeds a stable slug and a matching choices group for a blank improvement", async () => {
		const item = makeItem();
		const ctx  = await makeSheet(item)._prepareContext({});
		expect(item.update).toHaveBeenCalledOnce();
		expect(item.system.slug).toMatch(/^custom-improvement-/);
		// The choices group is namespaced by the same slug so track values don't collide across improvements.
		expect(item.system.choices).toEqual({ slug: item.system.slug, list: [] });
		expect(ctx.choicesGroup.slug).toBe(item.system.slug);
		expect(ctx.choicesGroup.cgPath).toBe("system.choices");
		expect(ctx.choicesGroup.rows).toEqual([]);
	});

	it("preserves an existing slug and choices group", async () => {
		const choices = { slug: "watchtower", list: [{ type: "entry", slug: "built", content: { text: "Done" } }] };
		const item = makeItem({ slug: "watchtower", sortOrder: 5, choices });
		const ctx  = await makeSheet(item)._prepareContext({});
		expect(item.update).not.toHaveBeenCalled();
		expect(ctx.choicesGroup.slug).toBe("watchtower");
		expect(ctx.choicesGroup.rows).toHaveLength(1);
		expect(ctx.choicesGroup.rows[0].slug).toBe("built");
		expect(ctx.system.sortOrder).toBe(5);
	});

	it("builds the rendered-view preview as the same ChoiceGroup the steading renders", async () => {
		const item = makeItem({ slug: "watchtower", choices: WATCHTOWER });
		const ctx  = await makeSheet(item)._prepareContext({});
		expect(ctx.preview).toBeInstanceOf(ChoiceGroup);
		expect(ctx.preview.slug).toBe("watchtower");
		// A catalog improvement has no track state of its own — tracks preview unchecked.
		expect(ctx.preview.list[0].track.checks).toEqual([false, false]);
	});

	it("exposes the item and editability for the template", async () => {
		const item = makeItem({ slug: "watchtower", choices: WATCHTOWER });
		const ctx  = await makeSheet(item)._prepareContext({});
		expect(ctx.item).toBe(item);
		expect(ctx.editable).toBe(true);
	});
});

/**
 * The choice group is only what an improvement COSTS. What it GIVES YOU used to be the book's payoff
 * sentence sitting at the end of those rows — a second statement of everything `system.effects`
 * already says, extracted for translation twice over — so it was stripped from the pack. Without a
 * payoff here the catalog would show a list of requirements and nothing about what meeting them is
 * for.
 */
describe("StonetopImprovementSheet — what the improvement gives you", () => {
	const MILL = {
		slug: "mill",
		choices: WATCHTOWER,
		requires: "built",
		effects: [
			{ when: { kind: "completed" }, change: { target: "fortunes", amount: 1 }, text: "increase Fortunes by 1" },
			{ when: { kind: "moment", moment: "autumn-harvest" }, change: { target: "surplus", amount: 1 },
			  text: "the steading generates +1 Surplus" },
		],
	};

	it("builds the payoff through the same snapshot the steading's card uses", async () => {
		const ctx = await makeSheet(makeItem(MILL))._prepareContext({});
		expect(ctx.payoff).toBeInstanceOf(ImprovementPayoff);
		expect(ctx.payoff.completion.lines.map(l => l.text.raw)).toEqual(["increase Fortunes by 1"]);
		expect(ctx.payoff.henceforth.lines.map(l => l.text.raw)).toEqual(["the steading generates +1 Surplus"]);
	});

	/**
	 * Read-only, on both halves. There is no steading here to write to, so a control would carry an
	 * action this sheet does not define and pressing it would do nothing at all.
	 */
	it("offers no control, because there is no steading behind it", async () => {
		const ctx = await makeSheet(makeItem(MILL))._prepareContext({});
		expect(ctx.payoff.completion.automatic).toEqual([]);
		expect(ctx.payoff.henceforth.automatic).toEqual([]);
		expect(ctx.payoff.isOwed).toBe(false);
	});

	// Track state lives on each steading that adopts the improvement, not on the catalog entry.
	it("counts nothing as earned, since the catalog ticks no boxes", async () => {
		const ctx = await makeSheet(makeItem(MILL))._prepareContext({});
		expect(ctx.payoff.completion.lines.every(l => l.earned)).toBe(false);
	});

	// A custom improvement authored in a world has no modelled results; the template skips the block
	// rather than drawing an empty heading.
	it("is empty for an improvement with no modelled results", async () => {
		const ctx = await makeSheet(makeItem({ slug: "watchtower", choices: WATCHTOWER }))._prepareContext({});
		expect(ctx.payoff.isEmpty).toBe(true);
	});
});

describe("StonetopImprovementSheet — view/edit mode", () => {
	it("opens an authored improvement in the rendered view", async () => {
		const ctx = await makeSheet(makeItem({ slug: "watchtower", choices: WATCHTOWER }))._prepareContext({});
		expect(ctx.editMode).toBe(false);
	});

	it("opens a blank improvement (no rows yet) in the editor", async () => {
		const ctx = await makeSheet(makeItem())._prepareContext({});
		expect(ctx.editMode).toBe(true);
	});

	it("forces view-only for a locked (non-editable) improvement", async () => {
		// Blank would normally open in the editor, but a locked item is always view-only.
		const ctx = await makeSheet(makeItem({ slug: "watchtower", choices: { slug: "watchtower", list: [] } }), { editable: false })._prepareContext({});
		expect(ctx.editMode).toBe(false);
	});

	it("the toggleEditMode action flips mode and re-renders", async () => {
		const item  = makeItem({ slug: "watchtower", choices: WATCHTOWER });
		const sheet = makeSheet(item);
		await sheet._prepareContext({});     // opens in view (authored)
		const Sheet = sheet.constructor;
		const toggle = Sheet.DEFAULT_OPTIONS.actions.toggleEditMode;

		toggle.call(sheet, new Event("click"), { dataset: { mode: "edit" } });
		expect(sheet.render).toHaveBeenCalledOnce();
		expect((await sheet._prepareContext({})).editMode).toBe(true);

		toggle.call(sheet, new Event("click"), { dataset: { mode: "view" } });
		expect((await sheet._prepareContext({})).editMode).toBe(false);
	});
});

describe("StonetopImprovementSheet._onRender", () => {
	it("wires the choice-group editor against the sheet's own element when editable", async () => {
		const item  = makeItem({ slug: "watchtower", choices: WATCHTOWER });
		const sheet = makeSheet(item);
		sheet.element.innerHTML = `
			<div data-cg-path="system.choices">
				<button class="choices-add-row" data-type="entry"></button>
			</div>`;

		sheet._onRender({}, {});
		sheet.element.querySelector(".choices-add-row").click();

		// The mixin resolved data-cg-path and appended an entry row through CG.addRow.
		expect(item.update).toHaveBeenCalledWith({
			"system.choices": expect.objectContaining({
				list: expect.arrayContaining([expect.objectContaining({ type: "entry" })]),
			}),
		});
	});

	it("wires nothing when the sheet is not editable", async () => {
		const item  = makeItem({ slug: "watchtower", choices: WATCHTOWER });
		const sheet = makeSheet(item, { editable: false });
		sheet.element.innerHTML = `
			<div data-cg-path="system.choices">
				<button class="choices-add-row" data-type="entry"></button>
			</div>`;

		sheet._onRender({}, {});
		sheet.element.querySelector(".choices-add-row").click();

		expect(item.update).not.toHaveBeenCalled();
	});
});
