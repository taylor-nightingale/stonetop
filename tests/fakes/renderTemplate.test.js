// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { renderPartial } from "./renderTemplate.js";
import { STONETOP_PARTIALS } from "../../src/handlebars/partials.js";

// Proves the harness compiles the system's real templates with the system's real helpers, so tests
// built on it inherit whatever the partials actually emit.

function el(html) {
	const holder = document.createElement("div");
	holder.innerHTML = html;
	return holder;
}

describe("renderTemplate harness", () => {
	it("compiles every registered partial", () => {
		// A partial that fails to compile is a syntax error nothing else in the suite would catch.
		for (const name of Object.keys(STONETOP_PARTIALS)) {
			expect(() => renderPartial(name, {}), `partial ${name}`).not.toThrow();
		}
	});

	it("runs the system's own helpers, not stand-ins", () => {
		// resourceChecks turns a resource into one entry per pip, marking the filled ones.
		const html = renderPartial("stonetop.move-item", {
			slug: "trade", name: "Trade", categoryKey: "homefront", showCheck: true,
			selection: { max: 1, value: 1 }, alwaysShowResource: true,
			resource: { current: 2, max: 3, labels: [] },
		});

		const pips = el(html).querySelectorAll(".stonetop-item-resource-check");
		expect(pips).toHaveLength(3);
		expect([...pips].map(p => p.classList.contains("is-checked"))).toEqual([true, true, false]);
	});

	it("resolves nested partial includes", () => {
		// move-item includes resource-input, which only renders when the resource has an input def.
		const html = renderPartial("stonetop.move-item", {
			slug: "trade", name: "Trade", showCheck: true, selection: { max: 1, value: 1 },
			alwaysShowResource: true,
			resource: { current: 0, max: 1, labels: [], input: { type: "inline", value: "grain" } },
		});

		expect(el(html).querySelector(".stonetop-resource-input")).not.toBeNull();
	});

	it("throws a useful error for a partial that does not exist", () => {
		expect(() => renderPartial("stonetop.not-a-partial")).toThrow(/No such Stonetop partial/);
	});
});
