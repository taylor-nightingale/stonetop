// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createStonetopActorSheetV2Class } from "../../src/actors/StonetopActorSheetV2.js";

// A minimal stand-in for HandlebarsApplicationMixin(ActorSheetV2): a persistent root element
// (unlike V1, V2 keeps the root across re-renders), the lifecycle hooks the class overrides, and
// core's built-in focus capture (id/name only) in _preSyncPartState.
//
// _syncPartState mirrors core verbatim, because our override delegates to it. The two supported
// Foundry generations disagree on what a scrollPositions entry holds — v13 stores the resolved
// ELEMENT, v14 stores the SELECTOR and re-queries — so the fake is built per generation and both
// are exercised. Getting that shape wrong is invisible at runtime (the assignment silently no-ops).
class FakeActorSheetV2Base {
	static scrollEntry = "element"; // "element" = v13.351, "selector" = v14.365

	constructor({ actor, editable = true } = {}) {
		this.actor = actor;
		this._editable = editable;
		this.element = document.createElement("div");
		document.body.appendChild(this.element);
	}
	get isEditable() { return this._editable; }
	// Mirrors core DocumentSheetV2: disable every form element in the sheet.
	_toggleDisabled(disabled) {
		for (const el of this.element.querySelectorAll("button, input, select, textarea")) el.disabled = disabled;
	}
	async _onFirstRender(_context, _options) {}
	_onRender(_context, _options) {}
	_preSyncPartState(partId, newElement, priorElement, state) {
		const focus = priorElement.querySelector(":focus");
		if (focus?.id) state.focus = `#${focus.id}`;
		else if (focus?.name) state.focus = `${focus.tagName}[name="${focus.name}"]`;
	}
	_syncPartState(partId, newElement, priorElement, state) {
		if (state.focus) {
			const newFocus = newElement.querySelector(state.focus);
			if (newFocus) newFocus.focus();
		}
		for (const [ref, scrollTop, scrollLeft] of state.scrollPositions) {
			const el = this.constructor.scrollEntry === "element"
				? ref
				: (ref === "" ? newElement : newElement.querySelector(ref));
			if (el) Object.assign(el, { scrollTop, scrollLeft });
		}
	}
	// Core DocumentSheetV2 hands back the expanded form data; the base narrows it.
	_processFormData(event, form, data) { return data; }
	_onPosition(_position) {}

	// Core's change→submit chain (application.mjs:1641 → :1617 → DocumentSheetV2's handler).
	// submitOnChange makes EVERY change on the form run this, whatever changed.
	_onChangeForm(formConfig, event) {
		if (formConfig.submitOnChange) this._onSubmitForm(formConfig, event);
	}

	_onSubmitForm(formConfig, event) {
		const form = event.currentTarget;
		// Stands in for FormDataExtended + expandObject: named controls → a nested object.
		const data = {};
		for (const el of form.querySelectorAll("[name]")) {
			if ((el.type === "radio" || el.type === "checkbox") && !el.checked) continue;
			let node = data;
			const parts = el.name.split(".");
			for (const key of parts.slice(0, -1)) node = node[key] ??= {};
			node[parts.at(-1)] = el.value;
		}
		this.document.update(this._processFormData(event, form, data));
	}
}

function makeSheet({ editable = true, scrollEntry = "element" } = {}) {
	const actor = { _onRoll: vi.fn(), update: vi.fn() };
	FakeActorSheetV2Base.scrollEntry = scrollEntry;
	const Sheet = createStonetopActorSheetV2Class();
	const sheet = new Sheet({ actor, editable });
	sheet.document = actor;
	return { sheet, actor };
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
		expect(Sheet.DEFAULT_OPTIONS.classes).toEqual(["stonetop", "sheet", "actor"]);
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

		// v14 changed a scrollPositions entry from the resolved element to a selector string. Our
		// override used to reimplement the restore loop against the v13 shape, so on v14 it assigned
		// scrollTop to a string and silently did nothing. Delegating to core keeps both working.
		it("restores scroll on v14, where an entry carries a selector rather than an element", () => {
			const { sheet } = makeSheet({ scrollEntry: "selector" });
			const newEl = document.createElement("div");
			newEl.innerHTML = `<div class="sheet-body"></div>`;
			document.body.appendChild(newEl);
			const state = { focus: null, scrollPositions: [[".sheet-body", 120, 4]] };

			sheet._syncPartState("form", newEl, document.createElement("div"), state);

			expect(newEl.querySelector(".sheet-body").scrollTop).toBe(120);
			expect(newEl.querySelector(".sheet-body").scrollLeft).toBe(4);
		});

		it("tolerates absent focus", () => {
			const { sheet } = makeSheet();
			expect(() =>
				sheet._syncPartState("form", document.createElement("div"), document.createElement("div"),
					{ scrollPositions: [] }),
			).not.toThrow();
		});

		// A render carries no scroll state of its own: core captures and restores in _syncPartState,
		// and nothing re-applies it afterwards (only a held anchor does — see ScrollAnchoring).
		it("leaves scroll alone on a render with no state of its own", () => {
			const { sheet } = makeSheet();
			const scroller = document.createElement("div");
			sheet._syncPartState("form", document.createElement("div"), document.createElement("div"),
				{ scrollPositions: [[scroller, 120, 0]] });

			scroller.scrollTop = 300; // the player scrolls after the render
			sheet._onRender({}, {});

			expect(scroller.scrollTop).toBe(300);
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

		// Steppers are template markup driven by one delegated handler, so a part re-render swapping
		// in fresh buttons needs no re-wiring.
		it("keeps driving steppers through a part re-render, without re-wiring", async () => {
			const { sheet } = makeSheet();
			await sheet._onFirstRender({}, {});

			const stepper = value => `
				<span class="stonetop-stepper">
					<input class="stonetop-step" type="number" value="${value}">
					<button class="stonetop-stepper-btn" data-step-dir="1"></button>
				</span>`;

			sheet.element.innerHTML = stepper(1);
			click(sheet.element.querySelector(".stonetop-stepper-btn"));
			expect(sheet.element.querySelector("input").value).toBe("2");

			sheet.element.innerHTML = stepper(9); // fresh content from a later render
			sheet._onRender({}, {});
			click(sheet.element.querySelector(".stonetop-stepper-btn"));
			expect(sheet.element.querySelector("input").value).toBe("10");
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

	describe("_toggleDisabled (observer-permission sheet)", () => {
		function makeSheetWithElement() {
			const { sheet } = makeSheet({ editable: false });
			sheet.element.innerHTML = `
				<button class="moves-filter" data-view-state></button>
				<button class="delete-follower"></button>
				<input class="hp">`;
			return sheet;
		}

		it("keeps [data-view-state] controls clickable when the sheet is disabled", () => {
			const sheet = makeSheetWithElement();
			sheet._toggleDisabled(true);
			expect(sheet.element.querySelector(".moves-filter").disabled).toBe(false);
			expect(sheet.element.querySelector(".delete-follower").disabled).toBe(true);
			expect(sheet.element.querySelector(".hp").disabled).toBe(true);
		});

		it("leaves everything enabled when the sheet is editable", () => {
			const sheet = makeSheetWithElement();
			sheet._toggleDisabled(false);
			expect(sheet.element.querySelector(".moves-filter").disabled).toBe(false);
			expect(sheet.element.querySelector(".delete-follower").disabled).toBe(false);
		});
	});

	// -- Form submit, end to end ---------------------------------------------------------------

	// Characterization net for the deferred `_onChangeForm` short-circuit. That change will stop a
	// data-change-action write from entering core's submit machinery at all; what must NOT change is
	// either half asserted here — core keeps persisting the fields it owns, and never persists the
	// ones a domain method owns.
	describe("submitOnChange, end to end", () => {
		const FORM_CONFIG = { submitOnChange: true };

		function formSheet(html) {
			const { sheet, actor } = makeSheet();
			const form = document.createElement("form");
			form.innerHTML = html;
			document.body.appendChild(form);
			return { sheet, actor, form };
		}

		const changeOn = (sheet, form, selector) =>
			sheet._onChangeForm(FORM_CONFIG, { currentTarget: form, target: form.querySelector(selector) });

		it("persists the stat inputs core legitimately owns", () => {
			const { sheet, actor, form } = formSheet(`
				<input name="name" value="Brakken">
				<input name="system.stats.str.value" value="2">`);

			changeOn(sheet, form, `[name="system.stats.str.value"]`);

			expect(actor.update).toHaveBeenCalledWith({
				name: "Brakken",
				system: { stats: { str: { value: "2" } } },
			});
		});

		// These carry a `name` only so the browser groups the radios; a domain method persists them.
		it("never persists a router-managed field, whichever control changed", () => {
			const { sheet, actor, form } = formSheet(`
				<input name="name" value="Brakken">
				<input type="radio" name="stonetop-roll-mode" value="adv" checked>
				<input type="radio" name="stonetop-background" value="vessel" checked>`);

			changeOn(sheet, form, `[name="stonetop-roll-mode"]`);

			const [written] = actor.update.mock.calls[0];
			expect(written).not.toHaveProperty("stonetop-roll-mode");
			expect(written).not.toHaveProperty("stonetop-background");
			expect(written).toEqual({ name: "Brakken" });
		});

		// The short-circuit itself: a control the ChangeActionRouter already persisted must not drag
		// the whole form through FormDataExtended + expandObject + a document validate.
		it("skips core's submit entirely for a router-managed control", () => {
			const { sheet, actor, form } = formSheet(`
				<input name="name" value="Brakken">
				<input data-change-action="hp" value="7">`);
			const submit = vi.spyOn(sheet, "_onSubmitForm");

			changeOn(sheet, form, `[data-change-action="hp"]`);

			expect(submit).not.toHaveBeenCalled();
			expect(actor.update).not.toHaveBeenCalled();
		});

		it("still submits for a control core owns, even beside router-managed ones", () => {
			const { sheet, actor, form } = formSheet(`
				<input name="system.stats.str.value" value="2">
				<input data-change-action="hp" value="7">`);

			changeOn(sheet, form, `[name="system.stats.str.value"]`);

			expect(actor.update).toHaveBeenCalledWith({ system: { stats: { str: { value: "2" } } } });
		});

		// The change can land on a child of the control (a combobox option, a chip inside a wrap).
		it("skips the submit for a descendant of a router-managed control", () => {
			const { sheet, actor, form } = formSheet(`
				<div data-change-action="tagAdd"><input class="inner" value="sturdy"></div>`);

			changeOn(sheet, form, ".inner");

			expect(actor.update).not.toHaveBeenCalled();
		});

		it("writes nothing at all when the form holds only router-managed fields", () => {
			const { sheet, actor, form } = formSheet(
				`<input type="radio" name="stonetop-fortunes" value="3" checked>`);

			changeOn(sheet, form, `[name="stonetop-fortunes"]`);

			expect(actor.update).toHaveBeenCalledWith({});
		});
	});

	// -- Form-submit filtering -----------------------------------------------------------------

	// submitOnChange submits the whole form on every change, but most named inputs on a Stonetop
	// sheet carry a `name` only for radio grouping and are persisted by a domain method. Letting
	// them through drives a second, redundant actor.update per change.
	describe("StonetopActorSheetV2._processFormData", () => {
		it("keeps only name/img/system, dropping the router-managed radio-group fields", () => {
			const { sheet } = makeSheet();
			const expanded = {
				name: "Brakken",
				system: { stats: { str: { value: 2 } } },
				"stonetop-roll-mode": "adv",
				"stonetop-background": "vessel",
				"stonetop-load-level": "light",
				"stonetop-origin": "the-hills",
			};
			expect(sheet._processFormData(null, null, expanded)).toEqual({
				name: "Brakken",
				system: { stats: { str: { value: 2 } } },
			});
		});

		it("omits keys that are absent rather than emitting undefined", () => {
			const { sheet } = makeSheet();
			expect(sheet._processFormData(null, null, { "stonetop-roll-mode": "dis" })).toEqual({});
		});

		// The steading's fortunes/attribute radios hit the same path, which is why this lives on the
		// base rather than on the character sheet.
		it("drops the steading's radio-group fields too", () => {
			const { sheet } = makeSheet();
			expect(sheet._processFormData(null, null, {
				"stonetop-fortunes": "3",
				"stonetop-attr-population": "2",
				system: { steadfast: "kith" },
			})).toEqual({ system: { steadfast: "kith" } });
		});
	});
});
