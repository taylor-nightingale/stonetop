// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { activateSteppers } from "../../src/utils/stepper.js";

// Characterization net for the stepper. It is currently built by JS DOM surgery after every render;
// if it ever moves into the partial (emitted markup + one delegated handler), these are the
// behaviors that must survive the move.

function mount(html) {
	document.body.innerHTML = `<div id="root">${html}</div>`;
	return document.getElementById("root");
}

const numberInput = (attrs = "") => mount(`<input class="stonetop-step" type="number" value="3" ${attrs}>`);
const up   = root => root.querySelector(".stonetop-stepper-btn--up");
const down = root => root.querySelector(".stonetop-stepper-btn--down");
const click = el => el.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));

beforeEach(() => { document.body.innerHTML = ""; });

describe("activateSteppers — structure", () => {
	it("wraps the input and gives it an up and a down button", () => {
		const root = numberInput();

		activateSteppers(root);

		const wrap = root.querySelector(".stonetop-stepper");
		expect(wrap).not.toBeNull();
		expect(wrap.querySelector("input.stonetop-step")).not.toBeNull();
		expect(up(root)).not.toBeNull();
		expect(down(root)).not.toBeNull();
	});

	// The buttons must never take tab focus or submit the form they sit in.
	it("builds non-submitting, non-focusable buttons", () => {
		const root = numberInput();
		activateSteppers(root);

		for (const btn of [up(root), down(root)]) {
			expect(btn.type).toBe("button");
			expect(btn.tabIndex).toBe(-1);
		}
	});

	it("leaves inputs that did not ask for a stepper alone", () => {
		const root = mount(`<input type="number" value="3">`);
		activateSteppers(root);
		expect(root.querySelector(".stonetop-stepper")).toBeNull();
	});

	it("decorates every stepper input under the root", () => {
		const root = mount(`
			<input class="stonetop-step" type="number" value="1">
			<input class="stonetop-step" type="number" value="2">`);
		activateSteppers(root);
		expect(root.querySelectorAll(".stonetop-stepper")).toHaveLength(2);
	});

	// Called on every render, so a still-decorated input must not gain a second set of buttons.
	it("is idempotent for an input it already wrapped", () => {
		const root = numberInput();

		activateSteppers(root);
		activateSteppers(root);

		expect(root.querySelectorAll(".stonetop-stepper")).toHaveLength(1);
		expect(root.querySelectorAll(".stonetop-stepper-btn")).toHaveLength(2);
	});

	it("tolerates a missing root", () => {
		expect(() => activateSteppers(null)).not.toThrow();
	});
});

describe("activateSteppers — stepping", () => {
	it("increments and decrements by one by default", () => {
		const root = numberInput();
		activateSteppers(root);
		const input = root.querySelector("input");

		click(up(root));
		expect(input.value).toBe("4");

		click(down(root));
		click(down(root));
		expect(input.value).toBe("2");
	});

	it("respects a custom step", () => {
		const root = numberInput(`step="5"`);
		activateSteppers(root);

		click(up(root));
		expect(root.querySelector("input").value).toBe("8");
	});

	it("clamps at min and max", () => {
		const root = numberInput(`min="2" max="4"`);
		activateSteppers(root);
		const input = root.querySelector("input");

		click(down(root));
		click(down(root)); // already at min, must not go below
		expect(input.value).toBe("2");

		click(up(root)); click(up(root)); click(up(root));
		expect(input.value).toBe("4");
	});

	it("treats a blank value as zero rather than NaN", () => {
		const root = mount(`<input class="stonetop-step" type="number" value="">`);
		activateSteppers(root);

		click(up(root));

		expect(root.querySelector("input").value).toBe("1");
	});

	// The value is what the sheet persists, so stepping has to look like typing.
	it("dispatches a bubbling change so the field's own handler saves", () => {
		const root = numberInput();
		activateSteppers(root);
		const seen = vi.fn();
		root.addEventListener("change", seen);

		click(up(root));

		expect(seen).toHaveBeenCalledTimes(1);
		expect(seen.mock.calls[0][0].bubbles).toBe(true);
	});

	// The buttons sit inside rows that carry their own click handling.
	it("does not let its click reach the surrounding row", () => {
		const root = numberInput();
		activateSteppers(root);
		const rowClick = vi.fn();
		root.addEventListener("click", rowClick);

		click(up(root));

		expect(rowClick).not.toHaveBeenCalled();
	});
});
