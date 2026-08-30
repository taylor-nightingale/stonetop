// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { SheetRail, RAIL_ACTIONS } from "../../src/utils/SheetRail.js";

function layout({ open = false, side = "left" } = {}) {
	const root = document.createElement("div");
	root.innerHTML = `
		<div class="stonetop-rail-layout${open ? " rail-open" : ""}" data-side="${side}">
			<button type="button" class="stonetop-rail-toggle" data-action="toggleRail" data-view-state
			        aria-expanded="${open}" aria-controls="rail">Rail</button>
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
		const rail = new SheetRail(el);
		expect(rail.isOpen).toBe(false);
		rail.toggle();
		expect(rail.isOpen).toBe(true);
		rail.toggle();
		expect(rail.isOpen).toBe(false);
	});

	it("exposes the toggle as an actions entry that works from the button", () => {
		const { el, toggle } = layout();
		RAIL_ACTIONS.toggleRail(new Event("click"), toggle);
		expect(el.classList.contains("rail-open")).toBe(true);
	});

	it("does nothing when the action fires outside a rail layout", () => {
		document.body.innerHTML = `<button type="button" id="loose">x</button>`;
		expect(() => RAIL_ACTIONS.toggleRail(new Event("click"), document.getElementById("loose"))).not.toThrow();
	});
});
