// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { renderPartial } from "../fakes/renderTemplate.js";
import { BarGrain } from "../../src/utils/BarGrain.js";

const parse = html => {
	const host = document.createElement("div");
	host.innerHTML = html;
	return host;
};

const bar = params => parse(renderPartial("stonetop.bar", params)).querySelector("header.stonetop-bar");

describe("the bar partial", () => {
	it("names its panel", () => {
		expect(bar({ title: "Basic Moves", index: 0 }).querySelector(".stonetop-bar-title").textContent)
			.toBe("Basic Moves");
	});

	it("wears the grain its title and place give it", () => {
		const el = bar({ title: "Expedition Moves", index: 1 });
		const grain = BarGrain.of("Expedition Moves", 1);
		expect(el.className).toBe(`stonetop-bar ${grain.classes}`.trim());
		expect(el.getAttribute("style")).toBe(grain.style);
	});

	it("carries the book's instruction only when it is given one", () => {
		expect(bar({ title: "Instinct", index: 0 }).querySelector(".stonetop-bar-note")).toBeNull();
		expect(bar({ title: "Instinct", index: 0, note: "(Choose 1)" }).querySelector(".stonetop-bar-note").textContent)
			.toBe("(Choose 1)");
	});

	it("hangs its control, drawn by the partial it names, at its right end", () => {
		const el = bar({
			title: "Basic Moves", index: 0, action: "stonetop.bar-toggle",
			controls: "x-basic", open: true, labelShow: "Show", labelHide: "Hide",
		});
		const toggle = el.querySelector(".stonetop-bar-meta .stonetop-bar-toggle");
		expect(toggle.getAttribute("aria-controls")).toBe("x-basic");
	});

	it("has an empty control slot without one", () => {
		expect(bar({ title: "Ailments", index: 0 }).querySelector(".stonetop-bar-meta").children).toHaveLength(0);
	});
});

describe("the bar's open-and-shut control", () => {
	const toggle = open => parse(renderPartial("stonetop.bar-toggle", {
		controls: "sheet-group-basic", open, labelShow: "Show the basic moves", labelHide: "Hide the basic moves",
	})).querySelector("button");

	it("is a disclosure for the region it names", () => {
		const el = toggle(true);
		expect(el.hasAttribute("data-disclosure")).toBe(true);
		expect(el.getAttribute("aria-controls")).toBe("sheet-group-basic");
		expect(el.dataset.action).toBe("toggleSliding");
	});

	// Opening a group to read it writes nothing, so it works on a sheet the reader cannot edit.
	it("stays live on a locked sheet", () => {
		expect(toggle(true).hasAttribute("data-view-state")).toBe(true);
	});

	it("says what pressing it will do", () => {
		expect(toggle(true).getAttribute("aria-expanded")).toBe("true");
		expect(toggle(true).getAttribute("aria-label")).toBe("Hide the basic moves");
		expect(toggle(false).getAttribute("aria-expanded")).toBe("false");
		expect(toggle(false).getAttribute("aria-label")).toBe("Show the basic moves");
		expect(toggle(false).title).toBe("Show the basic moves");
	});

	it("carries both wordings, so the label can follow the state without a redraw", () => {
		const el = toggle(true);
		expect(el.dataset.labelShow).toBe("Show the basic moves");
		expect(el.dataset.labelHide).toBe("Hide the basic moves");
	});
});
