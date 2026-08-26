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

	// Core's `tab` action is changeTab — pure view state — so a locked sheet's tab bar stays usable
	// without every nav needing the marker. A locked compendium playbook was stuck on one tab.
	it("re-enables tab navigation without the marker, and nothing else with an action", () => {
		const el = root(`
			<button class="tab-nav" data-action="tab" data-tab="moves"></button>
			<button class="delete" data-action="deleteThing"></button>`);

		reenableViewStateControls(el);

		expect(el.querySelector(".tab-nav").disabled).toBe(false);
		expect(el.querySelector(".delete").disabled).toBe(true);
	});

	// A sheet can be disabled before its part content exists.
	it("tolerates a missing root", () => {
		expect(() => reenableViewStateControls(null)).not.toThrow();
	});
});
