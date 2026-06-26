import { describe, expect, it } from "vitest";
import { markFaqItems } from "../../module/utils/faq-bullets.js";

// markFaqItems walks the DOM, but the test env is node (no DOM), so use tiny fake
// <p> nodes that expose just what the function touches: a `firstChild` (the lead
// node — a fake <strong> or a text node) and a classList.toggle(name, force).
function strong(text) { return { tagName: "STRONG", textContent: text }; }
function textNode(text) { return { textContent: text }; } // no tagName → not an element lead

function makeP(firstChild) {
	const classes = new Set();
	return {
		firstChild,
		classList: {
			toggle: (name, force) => (force ? classes.add(name) : classes.delete(name)),
		},
		get marked() { return classes.has("faq-item"); },
	};
}

function mark(...ps) {
	markFaqItems({ querySelectorAll: () => ps });
	return ps;
}

describe("markFaqItems", () => {
	it("marks a paragraph led by a bold question", () => {
		const [p] = mark(makeP(strong("How much damage do weapons do?")));
		expect(p.marked).toBe(true);
	});

	it("leaves the intro paragraph (no bold lead) unmarked", () => {
		const [p] = mark(makeP(textNode("As everyone works through their playbook…")));
		expect(p.marked).toBe(false);
	});

	it("leaves a bold lead that isn't a question unmarked (e.g. a place-name link)", () => {
		const [p] = mark(makeP(strong("The Flats")));
		expect(p.marked).toBe(false);
	});

	it("clears a stale marking when the paragraph is no longer a bold question", () => {
		const p = makeP(textNode("Plain prose now."));
		p.classList.toggle("faq-item", true);
		markFaqItems({ querySelectorAll: () => [p] });
		expect(p.marked).toBe(false);
	});

	it("no-ops on a root without querySelectorAll", () => {
		expect(() => markFaqItems(null)).not.toThrow();
		expect(() => markFaqItems({})).not.toThrow();
	});
});
