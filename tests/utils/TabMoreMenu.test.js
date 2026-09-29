// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { TabMoreMenu } from "../../src/utils/TabMoreMenu.js";

// The strip's "More" menu: its button opens and shuts it and says which; choosing a tab from it shuts
// it (core switches the tab); Escape shuts it and hands the focus back to the button; a click
// anywhere else shuts it. Delegated from a root that outlives re-renders, so wired once.

function sheet() {
	document.body.innerHTML = `
	<form id="root">
		<nav class="sheet-tabs">
			<div class="stonetop-tab-more">
				<button type="button" class="stonetop-tab-more-btn" aria-expanded="false" aria-controls="m">More</button>
				<div class="stonetop-tab-more-menu" id="m" hidden>
					<button type="button" class="stonetop-tab-more-item" data-action="tab" data-tab="notes">Notes</button>
				</div>
			</div>
		</nav>
		<div class="elsewhere">tab</div>
	</form>`;
	const root = document.getElementById("root");
	new TabMoreMenu().attach(root);
	const q = s => root.querySelector(s);
	return { root, button: q(".stonetop-tab-more-btn"), menu: q(".stonetop-tab-more-menu"), entry: q(".stonetop-tab-more-item"), elsewhere: q(".elsewhere") };
}

const click = el => el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
const isOpen = s => !s.menu.hidden && s.button.getAttribute("aria-expanded") === "true";

beforeEach(() => { document.body.innerHTML = ""; });

describe("TabMoreMenu", () => {
	it("opens from its button, and shuts from it again", () => {
		const s = sheet();
		click(s.button);
		expect(isOpen(s)).toBe(true);
		click(s.button);
		expect(isOpen(s)).toBe(false);
		expect(s.button.getAttribute("aria-expanded")).toBe("false");
	});

	it("shuts once a tab is chosen from it", () => {
		const s = sheet();
		click(s.button);
		click(s.entry);
		expect(isOpen(s)).toBe(false);
	});

	it("shuts on Escape and gives the focus back to its button", () => {
		const s = sheet();
		click(s.button);
		s.entry.focus();
		s.entry.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
		expect(isOpen(s)).toBe(false);
		expect(document.activeElement).toBe(s.button);
	});

	it("shuts on a click anywhere else", () => {
		const s = sheet();
		click(s.button);
		click(s.elsewhere);
		expect(isOpen(s)).toBe(false);
	});

	it("puts the focus on the first entry as it opens from the keyboard", () => {
		const s = sheet();
		s.button.focus();
		s.button.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
		expect(isOpen(s)).toBe(true);
		expect(document.activeElement).toBe(s.entry);
	});
});
