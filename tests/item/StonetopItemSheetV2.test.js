// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createStonetopItemSheetV2BaseClass } from "../../src/item/StonetopItemSheetV2.js";

// A lifecycle-faithful stand-in for ApplicationV2: run _initializeApplicationOptions, then FREEZE
// the options — proving the composed size-memory mixin injects the saved size pre-freeze.
// _toggleDisabled mirrors core DocumentSheetV2: disable every form element in the sheet.
class FakeItemSheetV2Base {
	constructor(options = {}) {
		this.options = Object.freeze(this._initializeApplicationOptions(options));
		this.position = { ...this.options.position };
		this.document = options.document;
	}
	_initializeApplicationOptions(options) {
		return { ...options, position: { width: 500, height: 400 } };
	}
	_toggleDisabled(disabled) {
		for (const el of this.element.querySelectorAll("button, input, select, textarea")) {
			el.disabled = disabled;
		}
	}
}

describe("StonetopItemSheetV2 base", () => {
	beforeEach(() => {
		global.foundry.applications.api = { HandlebarsApplicationMixin: Base => Base };
		global.foundry.applications.sheets = { ItemSheetV2: FakeItemSheetV2Base };
		// The composed size-memory mixin defaults to the setting-backed singleton.
		global.game.settings = {
			get: vi.fn(() => ({ "Item.move": { width: 900, height: 750 } })),
			set: vi.fn(),
		};
	});
	afterEach(() => {
		delete global.foundry.applications.api;
		delete global.foundry.applications.sheets;
		delete global.game.settings;
	});

	it("declares the item-sheet defaults: stonetop classes, resizable, submitOnChange", () => {
		const Sheet = createStonetopItemSheetV2BaseClass();
		// V2 defaults submitOnChange AND closeOnSubmit to false — without this opt-in,
		// name="system.x" inputs would never save.
		expect(Sheet.DEFAULT_OPTIONS.form.submitOnChange).toBe(true);
		expect(Sheet.DEFAULT_OPTIONS.classes).toEqual(["stonetop", "sheet", "item"]);
		expect(Sheet.DEFAULT_OPTIONS.window.resizable).toBe(true);
	});

	it("composes the size-memory mixin: a saved size lands in the frozen options", () => {
		const Sheet = createStonetopItemSheetV2BaseClass();
		const sheet = new Sheet({ document: { documentName: "Item", type: "move" } });
		expect(sheet.options.position).toMatchObject({ width: 900, height: 750 });
	});

	it("keeps the base default size when nothing is saved for the type", () => {
		global.game.settings.get = vi.fn(() => ({}));
		const Sheet = createStonetopItemSheetV2BaseClass();
		const sheet = new Sheet({ document: { documentName: "Item", type: "arcanum" } });
		expect(sheet.options.position).toMatchObject({ width: 500, height: 400 });
	});

	describe("_toggleDisabled (locked compendium item)", () => {
		function makeSheetWithElement() {
			const Sheet = createStonetopItemSheetV2BaseClass();
			const sheet = new Sheet({ document: { documentName: "Item", type: "arcanum" } });
			sheet.element = document.createElement("form");
			sheet.element.innerHTML = `
				<button class="flip" data-view-state></button>
				<button class="edit-field"></button>
				<input class="name-field">`;
			return sheet;
		}

		it("keeps [data-view-state] controls clickable when the sheet is disabled", () => {
			const sheet = makeSheetWithElement();
			sheet._toggleDisabled(true);
			expect(sheet.element.querySelector(".flip").disabled).toBe(false);   // view state survives
			expect(sheet.element.querySelector(".edit-field").disabled).toBe(true);
			expect(sheet.element.querySelector(".name-field").disabled).toBe(true);
		});

		it("leaves everything enabled when the sheet is editable", () => {
			const sheet = makeSheetWithElement();
			sheet._toggleDisabled(false);
			expect(sheet.element.querySelector(".flip").disabled).toBe(false);
			expect(sheet.element.querySelector(".edit-field").disabled).toBe(false);
		});
	});
});
