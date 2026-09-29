// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RailSlide } from "../../src/utils/RailSlide.js";
import { SLIDE_MS } from "../../src/utils/motion.js";

// A column rail's slide, marked on its layout for as long as the rail is moving, so the stylesheet
// can hold the column beside it at one width instead of re-laying the whole tab out every frame.
// happy-dom runs no transitions, so their end is fired by hand.

function layout() {
	document.body.innerHTML = `
		<div class="stonetop-rail-layout">
			<div class="stonetop-rail"><span class="inside"></span></div>
			<div class="stonetop-rail-main"></div>
		</div>`;
	return document.querySelector(".stonetop-rail-layout");
}

const ended = (el, propertyName = "margin-left") => {
	const event = new Event("transitionend", { bubbles: true });
	event.propertyName = propertyName;
	el.dispatchEvent(event);
};

const moving = el => el.classList.contains(RailSlide.MOVING);

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ""; });

describe("RailSlide", () => {
	it("marks the layout moving until the rail's slide ends", () => {
		const el = layout();
		new RailSlide(el).start();
		expect(moving(el)).toBe(true);
		ended(el.querySelector(".stonetop-rail"));
		expect(moving(el)).toBe(false);
	});

	// A visibility or colour transition ending is not the slide ending, and neither is a transition
	// on something inside the rail bubbling up.
	it("waits for the rail's own margin, not any transition that happens to end", () => {
		const el = layout();
		new RailSlide(el).start();
		ended(el.querySelector(".stonetop-rail"), "visibility");
		ended(el.querySelector(".inside"));
		expect(moving(el)).toBe(true);
	});

	it("clears the mark after the slide's length if the end is never reported", () => {
		const el = layout();
		new RailSlide(el).start();
		vi.advanceTimersByTime(SLIDE_MS + 99);
		expect(moving(el)).toBe(true);
		vi.advanceTimersByTime(1);
		expect(moving(el)).toBe(false);
	});

	// A second press mid-slide turns the rail round: one mark, and the clock starts again.
	it("restarts on a second press rather than letting the first press's clock clear it", () => {
		const el = layout();
		new RailSlide(el).start();
		vi.advanceTimersByTime(SLIDE_MS - 50);
		new RailSlide(el).start();
		vi.advanceTimersByTime(60);
		expect(moving(el)).toBe(true);
		vi.advanceTimersByTime(SLIDE_MS + 100);
		expect(moving(el)).toBe(false);
	});

	it("does not mark anything when motion is reduced — there is no slide to hold still for", () => {
		const el = layout();
		new RailSlide(el, { reduced: true }).start();
		expect(moving(el)).toBe(false);
	});

	it("reads reduced motion off the page by default", () => {
		const el = layout();
		const view = document.defaultView;
		const original = view.matchMedia;
		view.matchMedia = query => ({ matches: query.includes("reduce"), media: query });
		try {
			new RailSlide(el).start();
			expect(moving(el)).toBe(false);
		} finally {
			view.matchMedia = original;
		}
	});
});
