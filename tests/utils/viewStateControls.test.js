// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { reenableViewStateControls } from "../../src/utils/viewStateControls.js";

function root(html) {
	const el = document.createElement("form");
	el.innerHTML = html;
	for (const control of el.querySelectorAll("button, input")) control.disabled = true;
	return el;
}

describe("reenableViewStateControls", () => {
	it("re-enables only the [data-view-state] controls", () => {
		const el = root(`
			<button class="filter" data-view-state></button>
			<button class="delete"></button>
			<input class="hp">`);

		reenableViewStateControls(el);

		expect(el.querySelector(".filter").disabled).toBe(false);
		expect(el.querySelector(".delete").disabled).toBe(true);
		expect(el.querySelector(".hp").disabled).toBe(true);
	});

	// A sheet can be disabled before its part content exists.
	it("tolerates a missing root", () => {
		expect(() => reenableViewStateControls(null)).not.toThrow();
	});
});
