// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { RosterFocus } from "../../../src/actors/steading/RosterFocus.js";

/** A roster of three rows plus the reference panel beside it, as the Folk tab renders them. */
function tree() {
	document.body.innerHTML = `
		<div class="steading-folk-roster">
			<div class="steading-folk-row" data-id="a"><input type="text" class="n"></div>
			<div class="steading-folk-row" data-id="b"><input type="text" class="n"></div>
		</div>
		<div class="steading-folk-ref"></div>`;
	return document.body;
}

const focusedIds = root => [...root.querySelectorAll(".steading-folk-row.is-focused")].map(r => r.dataset.id);

describe("RosterFocus", () => {
	beforeEach(() => { document.body.innerHTML = ""; });

	it("starts with nothing focused", () => {
		expect(new RosterFocus().id).toBeNull();
	});

	// The caret follows the cursor: whichever row you are typing in is the one a click in the
	// reference column lands on, so nothing extra has to be clicked to say "this one".
	it("takes the row the focus landed in, from any control inside it", () => {
		const root = tree();
		const focus = new RosterFocus();
		focus.noteFocus(root.querySelector('[data-id="b"] input'));
		expect(focus.id).toBe("b");
	});

	it("ignores focus that lands outside any row", () => {
		const root = tree();
		const focus = new RosterFocus();
		focus.noteFocus(root.querySelector('[data-id="a"] input'));
		focus.noteFocus(root.querySelector(".steading-folk-ref"));
		expect(focus.id).toBe("a");
	});

	it("focusOn points the caret at a row the sheet has just created", () => {
		const focus = new RosterFocus();
		focus.focusOn("b");
		expect(focus.id).toBe("b");
	});

	it("clear gives up the row, which is how the next name click creates someone", () => {
		const focus = new RosterFocus();
		focus.focusOn("a");
		focus.clear();
		expect(focus.id).toBeNull();
	});
});

describe("RosterFocus.restore", () => {
	beforeEach(() => { document.body.innerHTML = ""; });

	it("marks the remembered row in a freshly rendered tree", () => {
		const root = tree();
		const focus = new RosterFocus();
		focus.focusOn("b");
		focus.restore(root);
		expect(focusedIds(root)).toEqual(["b"]);
		expect(root.querySelector('[data-id="b"]').getAttribute("aria-current")).toBe("true");
	});

	// Stated as "restore the state", not "mark one row": running it twice, or after the focused row
	// moved, can never leave two carets behind.
	it("unmarks the rows that are not focused", () => {
		const root = tree();
		const focus = new RosterFocus();
		focus.focusOn("a");
		focus.restore(root);
		focus.focusOn("b");
		focus.restore(root);
		expect(focusedIds(root)).toEqual(["b"]);
		expect(root.querySelector('[data-id="a"]').hasAttribute("aria-current")).toBe(false);
	});

	it("marks nothing when the focused row has since been deleted", () => {
		const root = tree();
		const focus = new RosterFocus();
		focus.focusOn("gone");
		focus.restore(root);
		expect(focusedIds(root)).toEqual([]);
	});

	// The reference column reads this to say whether a trait click has anywhere to land.
	it("tells the reference panel whether a row is focused", () => {
		const root = tree();
		const focus = new RosterFocus();
		const panel = root.querySelector(".steading-folk-ref");

		focus.restore(root);
		expect(panel.hasAttribute("data-folk-focused")).toBe(false);

		focus.focusOn("a");
		focus.restore(root);
		expect(panel.hasAttribute("data-folk-focused")).toBe(true);
	});
});
