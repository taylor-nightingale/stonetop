// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createStonetopActorSheetV2Class } from "../../src/actors/StonetopActorSheetV2.js";

// A minimal stand-in for HandlebarsApplicationMixin(ActorSheetV2): a persistent root element
// (unlike V1, V2 keeps the root across re-renders), the lifecycle hooks the class overrides, and
// core's built-in focus capture (id/name only) in _preSyncPartState.
class FakeActorSheetV2Base {
	constructor({ actor, editable = true } = {}) {
		this.actor = actor;
		this._editable = editable;
		this.element = document.createElement("div");
		document.body.appendChild(this.element);
	}
	get isEditable() { return this._editable; }
	async _onFirstRender(_context, _options) {}
	_onRender(_context, _options) {}
	_preSyncPartState(partId, newElement, priorElement, state) {
		const focus = priorElement.querySelector(":focus");
		if (focus?.id) state.focus = `#${focus.id}`;
		else if (focus?.name) state.focus = `${focus.tagName}[name="${focus.name}"]`;
	}
	_onPosition(_position) {}
}

function makeSheet({ editable = true } = {}) {
	const actor = { _onRoll: vi.fn() };
	const Sheet = createStonetopActorSheetV2Class();
	return { sheet: new Sheet({ actor, editable }), actor };
}

const click = el => el.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));

describe("StonetopActorSheetV2 base", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		global.foundry.applications.api = { HandlebarsApplicationMixin: Base => Base };
		global.foundry.applications.sheets = { ActorSheetV2: FakeActorSheetV2Base };
	});
	afterEach(() => {
		delete global.foundry.applications.api;
		delete global.foundry.applications.sheets;
	});

	it("declares the V1-matching defaults: stonetop classes, resizable, submitOnChange", () => {
		const Sheet = createStonetopActorSheetV2Class();
		// "themed theme-light" keeps core from imposing the client dark theme on the parchment.
		expect(Sheet.DEFAULT_OPTIONS.classes).toEqual(["stonetop", "sheet", "actor", "themed", "theme-light"]);
		expect(Sheet.DEFAULT_OPTIONS.window.resizable).toBe(true);
		expect(Sheet.DEFAULT_OPTIONS.form.submitOnChange).toBe(true);
	});

	describe("focus preservation (_preSyncPartState)", () => {
		it("upgrades state.focus for dataset-addressed controls core cannot re-find", () => {
			const { sheet } = makeSheet();
			const prior = document.createElement("div");
			document.body.appendChild(prior);
			prior.innerHTML = `<input class="stonetop-follower-hp" data-slug="bo">`;
			prior.querySelector("input").focus();

			const state = {};
			sheet._preSyncPartState("form", document.createElement("div"), prior, state);

			expect(state.focus).toBe(`.stonetop-follower-hp[data-slug="bo"]`);
		});

		it("keeps core's id-based selector when buildFocusSelector has nothing better", () => {
			const { sheet } = makeSheet();
			const prior = document.createElement("div");
			document.body.appendChild(prior);
			prior.innerHTML = `<input id="plain-field">`; // no stonetop class, no name
			prior.querySelector("input").focus();

			const state = {};
			sheet._preSyncPartState("form", document.createElement("div"), prior, state);

			expect(state.focus).toBe("#plain-field");
		});
	});

	describe("scroll-safe focus restore (_syncPartState)", () => {
		it("refocuses with preventScroll and restores the declared scroll positions", () => {
			const { sheet } = makeSheet();
			const newEl = document.createElement("div");
			newEl.innerHTML = `<input id="f">`;
			document.body.appendChild(newEl);
			const focusSpy = vi.spyOn(newEl.querySelector("input"), "focus");
			const scroller = document.createElement("div");
			const state = { focus: "#f", scrollPositions: [[scroller, 120, 4]] };

			sheet._syncPartState("form", newEl, document.createElement("div"), state);

			// preventScroll is the whole point: a bare focus() would scroll ancestors (the jump).
			expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
			expect(scroller.scrollTop).toBe(120);
			expect(scroller.scrollLeft).toBe(4);
		});

		it("tolerates absent focus and scrollPositions", () => {
			const { sheet } = makeSheet();
			expect(() =>
				sheet._syncPartState("form", document.createElement("div"), document.createElement("div"), {}),
			).not.toThrow();
		});
	});

	describe("listener wiring across the V2 render lifecycle", () => {
		it("wires root-delegated edit toggles once, so re-renders don't cancel the toggle out", async () => {
			const { sheet } = makeSheet();
			sheet.element.innerHTML = `
				<div class="stonetop-editable">
					<button class="stonetop-edit-toggle"></button>
					<input class="stonetop-editable__edit">
				</div>`;

			await sheet._onFirstRender({}, {});
			sheet._onRender({}, {}); // second render must NOT add another handler
			sheet._onRender({}, {});

			click(sheet.element.querySelector(".stonetop-edit-toggle"));
			// One handler → one toggle → editing. Duplicated handlers would toggle it back off.
			expect(sheet.element.querySelector(".stonetop-editable").classList.contains("is-editing")).toBe(true);
		});

		it("re-decorates steppers on every render, because part content is replaced", async () => {
			const { sheet } = makeSheet();
			sheet.element.innerHTML = `<input class="stonetop-step" type="number" value="1">`;
			await sheet._onFirstRender({}, {});
			sheet._onRender({}, {});
			expect(sheet.element.querySelector(".stonetop-stepper")).not.toBeNull();

			// Simulate a part re-render: fresh, undecorated content.
			sheet.element.innerHTML = `<input class="stonetop-step" type="number" value="2">`;
			sheet._onRender({}, {});
			expect(sheet.element.querySelector(".stonetop-stepper")).not.toBeNull();
		});

		it("routes .rollable[data-roll] clicks to the actor's roll handler", async () => {
			const { sheet, actor } = makeSheet();
			sheet.element.innerHTML = `<a class="rollable" data-roll="str">STR</a>`;
			await sheet._onFirstRender({}, {});

			click(sheet.element.querySelector(".rollable"));

			expect(actor._onRoll).toHaveBeenCalledTimes(1);
		});

		it("ignores roll clicks while non-editable, then honors them once editable", async () => {
			// Editability is checked per event (wiring happens exactly once, on first render, but a
			// sheet can gain ownership mid-session).
			const { sheet, actor } = makeSheet({ editable: false });
			sheet.element.innerHTML = `<a class="rollable" data-roll="str">STR</a>`;
			await sheet._onFirstRender({}, {});

			click(sheet.element.querySelector(".rollable"));
			expect(actor._onRoll).not.toHaveBeenCalled();

			sheet._editable = true;
			click(sheet.element.querySelector(".rollable"));
			expect(actor._onRoll).toHaveBeenCalledTimes(1);
		});
	});
});
