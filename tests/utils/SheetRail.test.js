// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { SheetRail, RailState, RAIL_ACTIONS } from "../../src/utils/SheetRail.js";

// The stylesheet is what says whether the rail is a column or an overlay, and there is no
// stylesheet here — so a drawer is simulated the way the real one is drawn: positioned over the tab.
function drawer(el) {
	el.querySelector(".stonetop-rail").style.position = "absolute";
}

function layout({ open = false, side = "left" } = {}) {
	const root = document.createElement("div");
	root.innerHTML = `
		<div class="stonetop-rail-layout${open ? " rail-open" : ""}" data-side="${side}">
			<button type="button" class="stonetop-rail-toggle" data-action="toggleRail" data-view-state
			        aria-expanded="${open}" aria-controls="rail"
			        data-label-show="Show the rail" data-label-hide="Hide the rail"
			        title="Show the rail" aria-label="Show the rail">Rail</button>
			<div class="stonetop-rail" id="rail">
				<span>not focusable</span>
				<button type="button" class="first">Fortunes</button>
				<button type="button">Surplus</button>
			</div>
			<section class="sheet-body"><button type="button" class="outside">Elsewhere</button></section>
		</div>`;
	document.body.replaceChildren(root);
	return {
		el:     root.querySelector(".stonetop-rail-layout"),
		toggle: root.querySelector(".stonetop-rail-toggle"),
		first:  root.querySelector(".first"),
		outside: root.querySelector(".outside"),
	};
}

describe("SheetRail", () => {
	beforeEach(() => document.body.replaceChildren());

	it("finds the rail from any control inside its layout", () => {
		const { toggle, el } = layout();
		expect(SheetRail.from(toggle)._layout).toBe(el);
	});

	it("is null for a control outside any rail layout", () => {
		document.body.innerHTML = `<button type="button" id="loose">x</button>`;
		expect(SheetRail.from(document.getElementById("loose"))).toBe(null);
	});

	it("opens: marks the layout, says so on the toggle, and moves focus into the rail", () => {
		const { el, toggle, first } = layout();
		new SheetRail(el).open();
		expect(el.classList.contains("rail-open")).toBe(true);
		expect(toggle.getAttribute("aria-expanded")).toBe("true");
		expect(document.activeElement).toBe(first);
	});

	it("focuses the rail's first CONTROL, never a bare element before it", () => {
		const { el, first } = layout();
		new SheetRail(el).open();
		expect(document.activeElement).toBe(first);
	});

	it("closes: unmarks the layout and restores focus to the toggle", () => {
		const { el, toggle } = layout({ open: true });
		const rail = new SheetRail(el);
		rail.open();
		rail.close();
		expect(el.classList.contains("rail-open")).toBe(false);
		expect(toggle.getAttribute("aria-expanded")).toBe("false");
		expect(document.activeElement).toBe(toggle);
	});

	// Closing happens for reasons other than the toggle — opening a move sheet closes the drawer
	// behind it. Yanking the focus back to the toggle then would take it off whatever just opened.
	it("leaves the focus alone when it is already outside the rail", () => {
		const { el, outside } = layout({ open: true });
		outside.focus();
		new SheetRail(el).close();
		expect(document.activeElement).toBe(outside);
	});

	it("toggles both ways", () => {
		const { el } = layout();
		drawer(el);
		const rail = new SheetRail(el);
		expect(rail.isOpen).toBe(false);
		rail.toggle();
		expect(rail.isOpen).toBe(true);
		rail.toggle();
		expect(rail.isOpen).toBe(false);
	});

	it("exposes the toggle as an actions entry that works from the button", () => {
		const { el, toggle } = layout();
		drawer(el);
		RAIL_ACTIONS.toggleRail(new Event("click"), toggle);
		expect(el.classList.contains("rail-open")).toBe(true);
	});

	it("does nothing when the action fires outside a rail layout", () => {
		document.body.innerHTML = `<button type="button" id="loose">x</button>`;
		expect(() => RAIL_ACTIONS.toggleRail(new Event("click"), document.getElementById("loose"))).not.toThrow();
	});
});

// The rail is put away and brought back at every width, so "is it open" cannot be a question about
// the class alone: with the reader having said nothing, it is whatever the width means.
describe("the three states", () => {
	beforeEach(() => document.body.replaceChildren());

	it("counts an untouched inline rail as open", () => {
		const { el } = layout();
		expect(new SheetRail(el).isOpen).toBe(true);
	});

	it("counts an untouched drawer as closed", () => {
		const { el } = layout();
		drawer(el);
		expect(new SheetRail(el).isOpen).toBe(false);
	});

	// The regression this whole change is for: above the breakpoint there used to be no way to say it.
	it("closes an inline rail, and says so on the layout and the toggle", () => {
		const { el, toggle } = layout();
		new SheetRail(el).toggle();
		expect(el.classList.contains("rail-shut")).toBe(true);
		expect(el.classList.contains("rail-open")).toBe(false);
		expect(toggle.getAttribute("aria-expanded")).toBe("false");
	});

	it("never carries both states at once", () => {
		const { el } = layout();
		const rail = new SheetRail(el);
		rail.close();
		rail.open();
		expect(el.classList.contains("rail-open")).toBe(true);
		expect(el.classList.contains("rail-shut")).toBe(false);
	});

	// A reader's own answer outlives the width: a drawer they opened stays open, a column they shut
	// stays shut.
	it("keeps the reader's answer over the width's", () => {
		const { el } = layout();
		drawer(el);
		const rail = new SheetRail(el);
		rail.open();
		expect(rail.isOpen).toBe(true);
	});

	// setOpen is the restore path, which runs on every re-render — including ones caused by typing
	// somewhere else entirely.
	it("restores state without moving the focus", () => {
		const { el, outside } = layout();
		outside.focus();
		new SheetRail(el).setOpen(true);
		expect(document.activeElement).toBe(outside);
	});

	it("is keyed by the region the toggle controls", () => {
		const { el } = layout();
		expect(new SheetRail(el).key).toBe("rail");
	});
});

describe("RailState", () => {
	beforeEach(() => document.body.replaceChildren());

	it("puts a rail the reader shut back the way they left it", () => {
		const { el } = layout();
		const state = new RailState();
		const rail = new SheetRail(el);
		rail.close();
		state.remember(rail);

		// What a re-render does: the whole part, classes and all, is replaced.
		const { el: fresh } = layout();
		state.restore(document.body);
		expect(fresh.classList.contains("rail-shut")).toBe(true);
	});

	it("leaves a rail nobody touched following the width", () => {
		const { el } = layout();
		new RailState().restore(document.body);
		expect(el.classList.contains("rail-shut")).toBe(false);
		expect(el.classList.contains("rail-open")).toBe(false);
	});

	it("remembers each rail separately", () => {
		const { el } = layout();
		el.querySelector(".stonetop-rail").id = "other";
		const state = new RailState();
		const other = new SheetRail(el);
		other.close();
		state.remember(other);

		const { el: fresh } = layout();
		state.restore(document.body);
		expect(fresh.classList.contains("rail-shut")).toBe(false);
	});

	// The action is what the sheet binds; the sheet is what remembers.
	it("is fed by the toggle action, with the sheet as `this`", () => {
		const { el, toggle } = layout();
		const sheet = { railState: new RailState() };
		RAIL_ACTIONS.toggleRail.call(sheet, new Event("click"), toggle);
		expect(sheet.railState._state.get("rail")).toBe(false);
	});
});

// The template ships one aria-expanded and the width decides the other, so the toggle is corrected
// once the sheet is in the document.
describe("what the toggle announces", () => {
	beforeEach(() => document.body.replaceChildren());

	it("says a width-default inline rail is expanded", () => {
		const { el, toggle } = layout();
		new RailState().restore(document.body);
		expect(toggle.getAttribute("aria-expanded")).toBe("true");
		expect(el.classList.contains("rail-open")).toBe(false);
	});

	it("leaves a width-default drawer announced as collapsed", () => {
		const { el, toggle } = layout();
		drawer(el);
		new RailState().restore(document.body);
		expect(toggle.getAttribute("aria-expanded")).toBe("false");
	});

	// A control named for the thing it acts on says nothing about what pressing it does — which is
	// what a rail toggle labelled "Arches and homefront moves" was. The verb comes off the button,
	// so each sheet words its own and this file stays out of the localisation business.
	it("names the button for what pressing it will do", () => {
		const { el, toggle } = layout();
		const rail = new SheetRail(el);
		rail.open();
		expect(toggle.getAttribute("aria-label")).toBe("Hide the rail");
		expect(toggle.getAttribute("title")).toBe("Hide the rail");
		rail.close();
		expect(toggle.getAttribute("aria-label")).toBe("Show the rail");
		expect(toggle.getAttribute("title")).toBe("Show the rail");
	});

	// The width decides the untouched state, so the label the template shipped is right at one width
	// and wrong at the other — the same correction aria-expanded needs, and at the same moment.
	it("corrects the shipped label for what the width turned out to mean", () => {
		const { toggle } = layout();
		new RailState().restore(document.body);
		expect(toggle.getAttribute("aria-label")).toBe("Hide the rail");
	});

	it("leaves the label alone on a toggle that carries no wording", () => {
		const { el, toggle } = layout();
		delete toggle.dataset.labelShow;
		delete toggle.dataset.labelHide;
		new SheetRail(el).open();
		expect(toggle.getAttribute("aria-label")).toBe("Show the rail");
		expect(toggle.getAttribute("aria-expanded")).toBe("true");
	});
});
