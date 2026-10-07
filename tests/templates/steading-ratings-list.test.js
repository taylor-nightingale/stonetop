// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { renderPartial } from "../fakes/renderTemplate.js";
import { RatingSnapshot } from "../../src/model/snapshot/steading/SteadingSnapshot.js";
import { SteadingDefaults } from "../../src/model/data/steading/SteadingDefaults.js";

// The list a rating justifies — Resources under Prosperity, Fortifications under Defenses. On the
// Play tab the rating IS the list's heading: its bar names the rating, rolls it, says what is bending
// it and sets it, so the rating and its evidence are one panel rather than a rating above a box.

const dom = html => {
	const root = document.createElement("div");
	root.innerHTML = html;
	return root.firstElementChild;
};

const list = params => dom(renderPartial("stonetop.steading-ratings-list", {
	title: "Fortifications, etc.", addLabel: "add a fortification", attr: "defenses",
	items: ["Village militia", "The Ringwall (low, stone)"], index: 2, editable: true, ...params,
}));

const defenses = opts => new RatingSnapshot(SteadingDefaults.attributes.defenses, opts);

describe("a rating's list", () => {
	describe("headed by its rating", () => {
		const panel = () => list({ rating: defenses({ current: 1 }) });

		it("names the rating on its bar, and the name rolls it", () => {
			const title = panel().querySelector(":scope > .stonetop-bar .stonetop-bar-title");
			expect(title.tagName).toBe("BUTTON");
			expect(title.dataset.roll).toBe("defenses");
			expect(title.textContent.trim()).toBe(defenses({ current: 1 }).title);
			expect(title.getAttribute("aria-label")).toContain(defenses({ current: 1 }).title);
		});

		it("sets the rating from the bar's far end", () => {
			const input = panel().querySelector(":scope > .stonetop-bar .stonetop-bar-meta input.steading-attr-input");
			expect(input.dataset.attr).toBe("defenses");
			expect(input.value).toBe("1");
			expect(panel().querySelector(":scope > .stonetop-bar .stonetop-bar-meta .stonetop-stepper")).not.toBeNull();
		});

		it("says what the rating's note says, marked with its kind", () => {
			const rating = defenses({ current: 1 });
			const note = list({ rating }).querySelector(":scope > .stonetop-bar .stonetop-bar-note");
			expect(note.textContent.trim()).toBe(rating.note);
			expect(note.classList.contains(`steading-bar-note--${rating.noteKind}`)).toBe(true);
		});

		it("lists the evidence straight under the bar", () => {
			const rows = [...panel().querySelectorAll(":scope > .stonetop-panel-body .stonetop-attr-extra")].map(t => t.value);
			expect(rows).toEqual(["Village militia", "The Ringwall (low, stone)"]);
		});

		// The list's own name is no longer on screen as a heading; its add control still says it.
		it("keeps the list's name on its add control", () => {
			expect(panel().querySelector(".stonetop-attr-extra-add").getAttribute("aria-label")).toBe("add a fortification");
		});
	});

	describe("without its rating", () => {
		it("is headed by the list's own name, and sets nothing", () => {
			const panel = list({});
			const title = panel.querySelector(":scope > .stonetop-bar .stonetop-bar-title");
			expect(title.tagName).toBe("SPAN");
			expect(title.textContent.trim()).toBe("Fortifications, etc.");
			expect(panel.querySelector(".stonetop-bar input")).toBeNull();
		});
	});
});
