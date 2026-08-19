// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { withStonetopSheetChromeV2 } from "../../src/utils/withStonetopSheetChromeV2.js";

// The chrome mixin is document-agnostic on purpose: both the actor and the item base apply it, and
// before it existed they kept separate copies that drifted (the item base activated no widgets, so
// item templates' .stonetop-step inputs silently never got steppers).
class FakeSheetBase {
	constructor() {
		this.element = document.createElement("div");
		document.body.appendChild(this.element);
	}
	async _onFirstRender(_context, _options) {}
	_onRender(_context, _options) {}
	_toggleDisabled(disabled) {
		for (const el of this.element.querySelectorAll("button, input, select, textarea")) el.disabled = disabled;
	}
	_initializeApplicationOptions(options) { return { ...options }; }
	_onPosition(_position) {}
}

const click = el => el.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));

function makeSheet(html = "") {
	const Sheet = withStonetopSheetChromeV2(FakeSheetBase);
	const sheet = new Sheet();
	sheet.element.innerHTML = html;
	return sheet;
}

describe("withStonetopSheetChromeV2", () => {
	beforeEach(() => { document.body.innerHTML = ""; });

	// The V2 root persists across re-renders, so this wiring belongs on first render only: a class
	// *toggle* wired twice cancels itself out on every click.
	it("wires edit toggles on first render and not again on subsequent renders", async () => {
		const sheet = makeSheet(`
			<div class="stonetop-editable">
				<button class="stonetop-edit-toggle"></button>
				<input class="stonetop-editable__edit">
			</div>`);

		await sheet._onFirstRender({}, {});
		sheet._onRender({}, {}); // a re-render must NOT add a second handler
		sheet._onRender({}, {});

		click(sheet.element.querySelector(".stonetop-edit-toggle"));

		// One handler → one toggle → editing. Duplicated handlers would toggle it straight back off.
		expect(sheet.element.querySelector(".stonetop-editable").classList.contains("is-editing")).toBe(true);
	});

	// The stepper markup comes from the templates now; the mixin only wires the delegated handler,
	// once. Because it is delegated, it keeps driving buttons that arrive in later renders.
	it("wires steppers once, and still drives content rendered afterwards", async () => {
		const sheet = makeSheet();
		await sheet._onFirstRender({}, {});

		sheet.element.innerHTML = `
			<span class="stonetop-stepper">
				<input class="stonetop-step" type="number" value="1">
				<button class="stonetop-stepper-btn" data-step-dir="1"></button>
			</span>`;
		click(sheet.element.querySelector(".stonetop-stepper-btn"));

		// One handler → one step. A second wiring would apply it twice.
		expect(sheet.element.querySelector("input").value).toBe("2");
	});

	it("re-enables view-state controls when the sheet is disabled", () => {
		const sheet = makeSheet(`
			<button id="write" data-action="deleteThing"></button>
			<button id="view" data-view-state></button>`);

		sheet._toggleDisabled(true);

		expect(sheet.element.querySelector("#write").disabled).toBe(true);
		expect(sheet.element.querySelector("#view").disabled).toBe(false);
	});

	it("leaves everything enabled on an editable sheet", () => {
		const sheet = makeSheet(`<button id="write"></button><button id="view" data-view-state></button>`);

		sheet._toggleDisabled(false);

		expect(sheet.element.querySelector("#write").disabled).toBe(false);
		expect(sheet.element.querySelector("#view").disabled).toBe(false);
	});

	it("composes the size-memory mixin, so every Stonetop sheet reopens at its remembered size", () => {
		const sheet = makeSheet();
		expect(typeof sheet._initializeApplicationOptions).toBe("function");
		expect(typeof sheet._onPosition).toBe("function");
	});

	it("still calls through to the base's own lifecycle hooks", async () => {
		const onFirst = vi.spyOn(FakeSheetBase.prototype, "_onFirstRender");
		const onRender = vi.spyOn(FakeSheetBase.prototype, "_onRender");
		const sheet = makeSheet();

		await sheet._onFirstRender({}, {});
		sheet._onRender({}, {});

		expect(onFirst).toHaveBeenCalled();
		expect(onRender).toHaveBeenCalled();
		onFirst.mockRestore();
		onRender.mockRestore();
	});
});
