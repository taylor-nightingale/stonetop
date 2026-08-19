// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ScrollAnchoring } from "../../src/utils/ScrollAnchoring.js";

const SEL = `.stonetop-arcanum-card[data-slug="cloak"]`;

// A scroll container holding one anchored card. getBoundingClientRect is stubbed because happy-dom
// has no layout: the card sits 40px below the container's top, shifted by however far it's scrolled.
function anchoredCard(scrollTop) {
	const root = document.createElement("div");
	root.innerHTML = `<section class="sheet-body">
		<div class="stonetop-arcanum-card" data-slug="cloak"></div></section>`;
	document.body.appendChild(root);
	const body = root.querySelector(".sheet-body");
	const card = root.querySelector(".stonetop-arcanum-card");
	body.scrollTop = scrollTop;
	body.getBoundingClientRect = () => ({ top: 0 });
	card.getBoundingClientRect = () => ({ top: 40 - body.scrollTop });
	return { root, body, card };
}

describe("ScrollAnchoring", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		vi.useFakeTimers();
	});
	afterEach(() => vi.useRealTimers());

	it("restores the anchored card's position on the render its write causes", async () => {
		const anchoring = new ScrollAnchoring();
		const { root, body, card } = anchoredCard(180);

		await anchoring.hold(card, SEL, ".sheet-body", async () => {
			body.scrollTop = 0;      // the re-render dropped the tab to the top
			anchoring.applyTo(root);
		});

		expect(body.scrollTop).toBe(180);
	});

	// The actual bug: an arcanum whose two sides grant different gear writes twice, and the second
	// render restores the mid-swap 0 that the first render's clamp left behind. A one-render anchor
	// is already gone by then.
	it("survives a second render, so a two-write action still lands where it started", async () => {
		const anchoring = new ScrollAnchoring();
		const { root, body, card } = anchoredCard(180);

		await anchoring.hold(card, SEL, ".sheet-body", async () => {
			body.scrollTop = 0;
			anchoring.applyTo(root); // render 1: the card's own update
			body.scrollTop = 0;      // render 2 captured the clamped 0 and restored it
			anchoring.applyTo(root); // render 2: the granted gear being removed
		});

		expect(body.scrollTop).toBe(180);
	});

	it("releases the anchor once the writes settle, leaving later scrolling alone", async () => {
		const anchoring = new ScrollAnchoring();
		const { root, body, card } = anchoredCard(180);
		await anchoring.hold(card, SEL, ".sheet-body", async () => {});
		vi.runAllTimers();

		body.scrollTop = 20; // the player scrolls, then something else re-renders the sheet
		anchoring.applyTo(root);

		expect(body.scrollTop).toBe(20);
	});

	it("releases the anchor even when the write throws, and returns the work's result", async () => {
		const anchoring = new ScrollAnchoring();
		const { card } = anchoredCard(180);

		await expect(anchoring.hold(card, SEL, ".sheet-body", async () => { throw new Error("write failed"); }))
			.rejects.toThrow("write failed");
		vi.runAllTimers();

		expect(await anchoring.hold(card, SEL, ".sheet-body", async () => "done")).toBe("done");
	});

	it("still runs the write when there is nothing to anchor", async () => {
		const anchoring = new ScrollAnchoring();
		const orphan = document.createElement("div");

		expect(await anchoring.hold(orphan, SEL, ".sheet-body", async () => "done")).toBe("done");
		expect(await anchoring.hold(null, SEL, ".sheet-body", async () => "done")).toBe("done");
		expect(() => anchoring.applyTo(document.createElement("div"))).not.toThrow();
	});

	it("does nothing before any anchor has been held", () => {
		const { root, body } = anchoredCard(180);
		body.scrollTop = 55;

		new ScrollAnchoring().applyTo(root);

		expect(body.scrollTop).toBe(55);
	});
});
