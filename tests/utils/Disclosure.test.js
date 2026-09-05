// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { Disclosure } from "../../src/utils/Disclosure.js";
import { MOVE_ROW_ACTIONS } from "../../src/actors/moveRowHandlers.js";

function rows(count = 2) {
	document.body.innerHTML = Array.from({ length: count }, (_, i) => `
		<li class="stonetop-item" data-disclosure-row>
			<div class="stonetop-item-header">
				<button type="button" class="stonetop-move-disclosure" data-action="toggleMoveBody" data-disclosure
				        aria-expanded="false" aria-controls="body-${i}">Move ${i}</button>
			</div>
			<div class="stonetop-move-body" id="body-${i}" hidden>
				<button type="button" class="stonetop-move-action">Send to chat</button>
			</div>
		</li>`).join("");
	return Array.from({ length: count }, (_, i) => ({
		row:    document.querySelectorAll(".stonetop-item")[i],
		toggle: document.querySelector(`[aria-controls="body-${i}"]`),
		body:   document.getElementById(`body-${i}`),
	}));
}

const click = toggle => MOVE_ROW_ACTIONS.toggleMoveBody(new Event("click"), toggle);

describe("Disclosure, as a move row uses it", () => {
	beforeEach(() => { document.body.innerHTML = ""; });

	it("starts shut", () => {
		const [a] = rows(1);
		expect(Disclosure.from(a.toggle).isOpen).toBe(false);
	});

	// `hidden`, not a class: a hidden region is out of the tab order and the accessibility tree, which
	// is what aria-expanded="false" is promising on its behalf.
	it("opens the region and says so on the button", () => {
		const [a] = rows(1);
		click(a.toggle);
		expect(a.body.hidden).toBe(false);
		expect(a.toggle.getAttribute("aria-expanded")).toBe("true");
	});

	it("shuts again on a second activation", () => {
		const [a] = rows(1);
		click(a.toggle);
		click(a.toggle);
		expect(a.body.hidden).toBe(true);
		expect(a.toggle.getAttribute("aria-expanded")).toBe("false");
	});

	it("marks the row so the caret and the gloss can follow without knowing about each other", () => {
		const [a] = rows(1);
		click(a.toggle);
		expect(a.row.classList.contains("is-open")).toBe(true);
		click(a.toggle);
		expect(a.row.classList.contains("is-open")).toBe(false);
	});

	// The rail scrolls, so there is no space argument for closing something the reader left open.
	it("is independent, not an accordion", () => {
		const [a, b] = rows(2);
		click(a.toggle);
		click(b.toggle);
		expect(a.body.hidden).toBe(false);
		expect(b.body.hidden).toBe(false);
	});

	it("is null for a button that controls nothing", () => {
		document.body.innerHTML = `<button type="button" id="loose">x</button>`;
		expect(Disclosure.from(document.getElementById("loose"))).toBe(null);
	});

	it("does nothing when the action fires on such a button", () => {
		document.body.innerHTML = `<button type="button" id="loose" aria-controls="nope">x</button>`;
		expect(() => click(document.getElementById("loose"))).not.toThrow();
	});
});
