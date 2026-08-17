// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { ScrollAnchor } from "../../src/utils/ScrollAnchor.js";

// happy-dom does no layout, so geometry is stubbed: each element reports a top of
// (its own `_top` - the container's scrollTop), which is how a real scroll container behaves.
function layout(el, top) {
	el._top = top;
	el.getBoundingClientRect = () => {
		const container = el.closest(".sheet-body");
		const scrolled = el.classList.contains("sheet-body") ? 0 : (container?.scrollTop ?? 0);
		return { top: el._top - scrolled };
	};
	return el;
}

/** A scroll container at viewport top 0 holding `cards` cards, each `height` tall. */
function sheet({ cards = 4, height = 100, scrollTop = 0 } = {}) {
	const root = document.createElement("div");
	root.innerHTML = `<section class="sheet-body">${
		Array.from({ length: cards }, (_, i) => `<div class="stonetop-arcanum-card" data-slug="card-${i}"></div>`).join("")
	}</section>`;
	const body = root.querySelector(".sheet-body");
	layout(body, 0);
	body.scrollTop = scrollTop;
	root.querySelectorAll(".stonetop-arcanum-card").forEach((c, i) => layout(c, i * height));
	return { root, body };
}

const CARD_2 = `.stonetop-arcanum-card[data-slug="card-2"]`;

describe("ScrollAnchor", () => {
	it("keeps the anchored card at the same place on screen when content above it grows", () => {
		const before = sheet({ scrollTop: 250 });
		const card = before.body.querySelector(CARD_2);
		const wasAt = card.getBoundingClientRect().top; // -50: scrolled just past the container's top edge
		const anchor = ScrollAnchor.capture(card, CARD_2, ".sheet-body");

		// Re-render: the card above the anchor got 60px taller, so every later card moved down.
		const after = sheet({ scrollTop: 250 });
		after.root.querySelectorAll(".stonetop-arcanum-card").forEach((c, i) => layout(c, i * 100 + (i >= 2 ? 60 : 0)));

		anchor.restore(after.root);

		expect(after.root.querySelector(CARD_2).getBoundingClientRect().top).toBe(wasAt);
		expect(after.body.scrollTop).toBe(310); // followed the card down by the 60px added above it
	});

	it("keeps it still when content above it shrinks", () => {
		const before = sheet({ scrollTop: 250 });
		const anchor = ScrollAnchor.capture(before.body.querySelector(CARD_2), CARD_2, ".sheet-body");

		const after = sheet({ scrollTop: 250 });
		after.root.querySelectorAll(".stonetop-arcanum-card").forEach((c, i) => layout(c, i * 100 - (i >= 2 ? 40 : 0)));
		anchor.restore(after.root);

		expect(after.body.scrollTop).toBe(210);
	});

	// The bug this exists for: ApplicationV2 already reset the container to 0 before we get here.
	it("recovers the position even when the container comes back scrolled to the top", () => {
		const before = sheet({ scrollTop: 250 });
		const anchor = ScrollAnchor.capture(before.body.querySelector(CARD_2), CARD_2, ".sheet-body");

		const after = sheet({ scrollTop: 0 });
		anchor.restore(after.root);

		expect(after.body.scrollTop).toBe(250);
	});

	it("falls back to the captured scrollTop when the anchor is gone from the new DOM", () => {
		const before = sheet({ scrollTop: 250 });
		const anchor = ScrollAnchor.capture(before.body.querySelector(CARD_2), CARD_2, ".sheet-body");

		const after = sheet({ cards: 1, scrollTop: 0 });
		anchor.restore(after.root);

		expect(after.body.scrollTop).toBe(250);
	});

	it("captures nothing when the element is missing or outside any scroll container", () => {
		expect(ScrollAnchor.capture(null, CARD_2, ".sheet-body")).toBeNull();
		const orphan = layout(document.createElement("div"), 0);
		expect(ScrollAnchor.capture(orphan, CARD_2, ".sheet-body")).toBeNull();
	});

	it("does nothing when the container is missing from the re-rendered root", () => {
		const before = sheet({ scrollTop: 250 });
		const anchor = ScrollAnchor.capture(before.body.querySelector(CARD_2), CARD_2, ".sheet-body");
		expect(() => anchor.restore(document.createElement("div"))).not.toThrow();
		expect(() => anchor.restore(null)).not.toThrow();
	});
});
