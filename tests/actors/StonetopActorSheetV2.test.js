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

		// A render carries no scroll state of its own: core captures and restores in _syncPartState,
		// and nothing re-applies it afterwards (only a held anchor does — see keepAnchored).
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

	describe("keepAnchored (holding a card still across every render an action causes)", () => {
		const SEL = `.stonetop-arcanum-card[data-slug="cloak"]`;

		function sheetWithCard(scrollTop) {
			const { sheet } = makeSheet();
			sheet.element.innerHTML = `<section class="sheet-body">
				<div class="stonetop-arcanum-card" data-slug="cloak"></div></section>`;
			const body = sheet.element.querySelector(".sheet-body");
			const card = sheet.element.querySelector(".stonetop-arcanum-card");
			body.scrollTop = scrollTop;
			body.getBoundingClientRect = () => ({ top: 0 });
			card.getBoundingClientRect = () => ({ top: 40 - body.scrollTop });
			return { sheet, body, card };
		}

		beforeEach(() => vi.useFakeTimers());
		afterEach(() => vi.useRealTimers());

		it("restores the anchored card's position on the render its write causes", async () => {
			const { sheet, body, card } = sheetWithCard(180);

			await sheet.keepAnchored(card, SEL, ".sheet-body", async () => {
				body.scrollTop = 0;      // the re-render dropped the tab to the top
				sheet._onRender({}, {});
			});

			expect(body.scrollTop).toBe(180);
		});

		// The actual bug: an arcanum whose two sides grant different gear writes twice, and the second
		// render restores the mid-swap 0 that the first render's clamp left behind. A one-render
		// anchor is already gone by then.
		it("survives a second render, so a two-write action still lands where it started", async () => {
			const { sheet, body, card } = sheetWithCard(180);

			await sheet.keepAnchored(card, SEL, ".sheet-body", async () => {
				body.scrollTop = 0;
				sheet._onRender({}, {}); // render 1: the card's own update
				body.scrollTop = 0;      // render 2 captured the clamped 0 and restored it
				sheet._onRender({}, {}); // render 2: the granted gear being removed
			});

			expect(body.scrollTop).toBe(180);
		});

		it("releases the anchor once the writes settle, leaving later scrolling alone", async () => {
			const { sheet, body, card } = sheetWithCard(180);
			await sheet.keepAnchored(card, SEL, ".sheet-body", async () => {});
			vi.runAllTimers();

			body.scrollTop = 20; // the player scrolls, then something else re-renders the sheet
			sheet._onRender({}, {});

			expect(body.scrollTop).toBe(20);
		});

		it("releases the anchor even when the write throws, and returns the work's result", async () => {
			const { sheet, card } = sheetWithCard(180);
			await expect(sheet.keepAnchored(card, SEL, ".sheet-body", async () => { throw new Error("write failed"); }))
				.rejects.toThrow("write failed");
			vi.runAllTimers();

			expect(await sheet.keepAnchored(card, SEL, ".sheet-body", async () => "done")).toBe("done");
		});

		it("still runs the write when there is nothing to anchor", async () => {
			const { sheet } = makeSheet();
			const orphan = document.createElement("div");
			expect(await sheet.keepAnchored(orphan, SEL, ".sheet-body", async () => "done")).toBe("done");
			expect(await sheet.keepAnchored(null, SEL, ".sheet-body", async () => "done")).toBe("done");
			expect(() => sheet._onRender({}, {})).not.toThrow();
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
});
