// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { renderPartial } from "../fakes/renderTemplate.js";
import { RatingSnapshot } from "../../src/model/snapshot/steading/SteadingSnapshot.js";
import { SteadingDefaults } from "../../src/model/data/steading/SteadingDefaults.js";

// Renders the real tile partial from real snapshots. The tile replaced a ladder of five radios per
// rating; what has to survive that is the value itself — which the ladder never actually stated —
// plus everything the book and the steading's debilities say about it.

const dom = html => {
	const root = document.createElement("div");
	root.innerHTML = html;
	return root;
};

const tile = (def, opts = {}, params = {}) =>
	dom(renderPartial("stonetop.steading-stat-panel", {
		attr: def.slug,
		attrData: new RatingSnapshot(def, opts),
		editable: true,
		...params,
	}));

describe("the steading ledger tile", () => {
	describe("a numeric rating", () => {
		it("states its value in a stepper bounded by the book's range", () => {
			const input = tile(SteadingDefaults.attributes.defenses, { current: 1 })
				.querySelector("input.steading-attr-input");
			expect(input.value).toBe("1");
			expect(input.getAttribute("min")).toBe("-1");
			expect(input.getAttribute("max")).toBe("3");
			expect(input.getAttribute("data-attr")).toBe("defenses");
			// The generic handler, unless the caller names a more specific one.
			expect(input.getAttribute("data-change-action")).toBe("attribute");
		});

		it("carries the ▲▼ the shared stepper drives", () => {
			const root = tile(SteadingDefaults.attributes.population, { current: 0 });
			expect(root.querySelector(".stonetop-stepper")).not.toBeNull();
			expect(root.querySelectorAll(".stonetop-stepper-btn").length).toBe(2);
		});

		it("names the tier word the book gives that number", () => {
			const note = tile(SteadingDefaults.attributes.defenses, { current: 2 })
				.querySelector(".steading-tile-note");
			expect(note.textContent.trim()).toBe("stonetop.steading.tier.defenses.formidable");
			expect(note.classList.contains("steading-tile-note--tier")).toBe(true);
		});

		it("says nothing about a tier for a rating the book gives no words", () => {
			expect(tile(SteadingDefaults.attributes.population, { current: 2 })
				.querySelector(".steading-tile-note")).toBeNull();
		});

		it("floors Surplus at zero without inventing a ceiling", () => {
			const input = tile(SteadingDefaults.surplus, { current: 3 })
				.querySelector("input.steading-attr-input");
			expect(input.getAttribute("min")).toBe("0");
			expect(input.hasAttribute("max")).toBe(false);
		});
	});

	describe("a named rating", () => {
		it("picks from its tiers rather than stepping", () => {
			const root = tile(SteadingDefaults.attributes.size, { current: "town" });
			expect(root.querySelector("input.steading-attr-input")).toBeNull();
			const select = root.querySelector("select.steading-attr-input");
			expect([...select.options].map(o => o.value)).toEqual(["hamlet", "village", "town", "city"]);
			expect(select.querySelector("option[selected]").value).toBe("town");
		});

		// A select shows its first option when nothing matches, so an unset Size would read as a
		// hamlet — which is a claim the data never made.
		it("offers an unset option when nothing has been chosen yet", () => {
			const select = tile(SteadingDefaults.attributes.size, { current: "" })
				.querySelector("select.steading-attr-input");
			expect([...select.options].length).toBe(5);
			expect(select.querySelector("option[selected]").value).toBe("");
			expect(select.options[0].value).toBe("");
		});

		it("offers no unset option once a tier is chosen", () => {
			const select = tile(SteadingDefaults.attributes.size, { current: "town" })
				.querySelector("select.steading-attr-input");
			expect([...select.options].length).toBe(4);
		});

		it("shows its population band, and leaves the tier name to the select", () => {
			const note = tile(SteadingDefaults.attributes.size, { current: "village" })
				.querySelector(".steading-tile-note");
			expect(note.textContent.trim()).toBe("stonetop.steading.band.village");
			expect(note.classList.contains("steading-tile-note--band")).toBe(true);
		});
	});

	describe("what the tile says about a value", () => {
		// "was +0" is the least useful of the four things a rating can say and the most frequent, so
		// it put a third element on nearly every rating and made the value ambiguous. The baseline is
		// still stored as part of the steadfast's definition; it just isn't shown beside the value.
		it("does not show where a rating started, even once it has moved", () => {
			const root = tile(SteadingDefaults.attributes.prosperity, { current: 2, starting: 0 });
			expect(root.querySelector(".steading-tile-note")).toBeNull();
			expect(root.textContent).not.toContain("was");
		});

		it("still carries the starting value for whatever wants it later", () => {
			const snapshot = new RatingSnapshot(SteadingDefaults.attributes.prosperity, { current: 2, starting: 0 });
			expect(snapshot.startingNote).toBe("was +0");
		});

		// A framed tile has one line under its value, so the four things a rating might say are
		// ranked. A debility acting on it right now outranks everything else.
		it("gives the line to the debility when one is acting on the rating", () => {
			const note = tile(SteadingDefaults.attributes.prosperity, {
				current: 2, starting: 0, adjustment: { delta: -1, debility: "lacking" },
			}).querySelector(".steading-tile-note");
			expect(note.classList.contains("steading-tile-note--adjustment")).toBe(true);
		});

		// Stated as the number you actually roll, not as the delta: "1  −1 lacking" printed on one
		// line reads as two values, which is the confusion this wording exists to end.
		it("gives the value the debility leaves, and names the debility", () => {
			const root = tile(SteadingDefaults.attributes.prosperity, {
				current: 1,
				adjustment: { delta: -1, debility: "lacking" },
			});
			const adjustment = root.querySelector(".steading-tile-note").textContent.trim();
			expect(adjustment).toContain("+0");
			expect(adjustment).toContain("lacking");
			expect(adjustment).not.toContain("−1");
			// The stored value is still what the stepper shows and what you edit.
			expect(root.querySelector("input.steading-attr-input").value).toBe("1");
		});

		it("says nothing when no debility touches it", () => {
			expect(tile(SteadingDefaults.attributes.prosperity, { current: 1 })
				.querySelector(".steading-tile-note")).toBeNull();
		});
	});

	describe("rolling", () => {
		it("makes the rating's name the roll button", () => {
			const button = tile(SteadingDefaults.attributes.defenses, { current: 0 }, { rollable: true })
				.querySelector("button.steading-stat-roll");
			expect(button.getAttribute("data-roll")).toBe("defenses");
			// Named for what it does, not just what it is.
			expect(button.getAttribute("aria-label")).toContain("Roll");
		});

		it("leaves a rating nothing rolls as plain text", () => {
			const root = tile(SteadingDefaults.surplus, { current: 1 });
			expect(root.querySelector("button.steading-stat-roll")).toBeNull();
			expect(root.querySelector(".steading-tile-title")).not.toBeNull();
		});
	});

	it("disables its control on a sheet that cannot be edited", () => {
		const root = tile(SteadingDefaults.attributes.defenses, { current: 0 }, { editable: false });
		expect(root.querySelector("input.steading-attr-input").hasAttribute("disabled")).toBe(true);
	});

	// The steadfast item sheet has no change router and binds these by class name, so the class is a
	// contract between two files rather than a styling hook.
	it("keeps the class the steadfast sheet binds on", () => {
		const root = tile(SteadingDefaults.attributes.prosperity, { current: 0 });
		expect(root.querySelector(".steading-attr-input[data-attr='prosperity']")).not.toBeNull();
	});

	// The line abbreviates when it is tight, but only in the eye: the full word never leaves the DOM,
	// so nothing a screen reader announces shrinks to something it would have to decode.
	describe("labels that abbreviate", () => {
		it("carries both the full word and its short form", () => {
			const label = tile(SteadingDefaults.attributes.prosperity, { current: 1 })
				.querySelector(".steading-tile-label");
			expect(label.querySelector(".steading-title-full").textContent.trim())
				.toBe("stonetop.steading.attr.prosperity");
			expect(label.querySelector(".steading-title-short").textContent.trim())
				.toBe("stonetop.steading.attrShort.prosperity");
		});

		it("hides the short form from assistive tech, never the full one", () => {
			const label = tile(SteadingDefaults.attributes.defenses, { current: 1 })
				.querySelector(".steading-tile-label");
			expect(label.querySelector(".steading-title-short").getAttribute("aria-hidden")).toBe("true");
			expect(label.querySelector(".steading-title-full").hasAttribute("aria-hidden")).toBe(false);
		});

		it("keeps the roll's accessible name spelled out in full", () => {
			const button = tile(SteadingDefaults.attributes.defenses, { current: 1 }, { rollable: true })
				.querySelector("button.steading-stat-roll");
			expect(button.getAttribute("aria-label")).toContain("stonetop.steading.attr.defenses");
		});
	});
});
