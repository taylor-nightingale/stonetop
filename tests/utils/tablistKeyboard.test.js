// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { activateTablistKeys } from "../../src/utils/tablistKeyboard.js";

function tablist(count = 3, activeIndex = 0) {
	const root = document.createElement("div");
	root.innerHTML = `
		<nav role="tablist">
			${Array.from({ length: count }, (_, i) => `
				<button type="button" role="tab" data-tab="t${i}"
				        aria-selected="${i === activeIndex}" tabindex="${i === activeIndex ? 0 : -1}">Tab ${i}</button>`).join("")}
		</nav>
		<button type="button" class="not-a-tab">Elsewhere</button>`;
	document.body.replaceChildren(root);
	activateTablistKeys(root);
	return { root, tabs: [...root.querySelectorAll('[role="tab"]')] };
}

const press = (el, key) => el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));

describe("activateTablistKeys", () => {
	beforeEach(() => document.body.replaceChildren());

	it("moves focus to the next tab on ArrowRight", () => {
		const { tabs } = tablist();
		tabs[0].focus();
		press(tabs[0], "ArrowRight");
		expect(document.activeElement).toBe(tabs[1]);
	});

	it("moves to the previous tab on ArrowLeft", () => {
		const { tabs } = tablist();
		tabs[2].focus();
		press(tabs[2], "ArrowLeft");
		expect(document.activeElement).toBe(tabs[1]);
	});

	it("wraps around both ends", () => {
		const { tabs } = tablist();
		tabs[2].focus();
		press(tabs[2], "ArrowRight");
		expect(document.activeElement).toBe(tabs[0]);

		press(tabs[0], "ArrowLeft");
		expect(document.activeElement).toBe(tabs[2]);
	});

	it("treats Up/Down the same as Left/Right, for a vertical tab row", () => {
		const { tabs } = tablist();
		tabs[0].focus();
		press(tabs[0], "ArrowDown");
		expect(document.activeElement).toBe(tabs[1]);
		press(tabs[1], "ArrowUp");
		expect(document.activeElement).toBe(tabs[0]);
	});

	it("jumps to the ends on Home and End", () => {
		const { tabs } = tablist();
		tabs[1].focus();
		press(tabs[1], "End");
		expect(document.activeElement).toBe(tabs[2]);
		press(tabs[2], "Home");
		expect(document.activeElement).toBe(tabs[0]);
	});

	// Automatic activation: moving to a tab opens it, which is the recommended pattern when showing
	// the panel is cheap — here it is a class toggle.
	it("activates the tab it moves to", () => {
		const { tabs } = tablist();
		const clicked = vi.fn();
		tabs[1].addEventListener("click", clicked);
		tabs[0].focus();
		press(tabs[0], "ArrowRight");
		expect(clicked).toHaveBeenCalled();
	});

	it("consumes the key so the page doesn't also scroll", () => {
		const { tabs } = tablist();
		tabs[0].focus();
		const ev = new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true });
		tabs[0].dispatchEvent(ev);
		expect(ev.defaultPrevented).toBe(true);
	});

	it("ignores keys pressed outside a tab", () => {
		const { root, tabs } = tablist();
		const elsewhere = root.querySelector(".not-a-tab");
		elsewhere.focus();
		press(elsewhere, "ArrowRight");
		expect(document.activeElement).toBe(elsewhere);
		expect(tabs.some(t => t === document.activeElement)).toBe(false);
	});

	it("ignores keys it has no move for", () => {
		const { tabs } = tablist();
		tabs[0].focus();
		press(tabs[0], "a");
		expect(document.activeElement).toBe(tabs[0]);
	});

	it("leaves a lone tab alone", () => {
		const { tabs } = tablist(1);
		tabs[0].focus();
		press(tabs[0], "ArrowRight");
		expect(document.activeElement).toBe(tabs[0]);
	});
});
