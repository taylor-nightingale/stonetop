// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { revealInScroller } from "../../src/utils/revealInScroller.js";

/**
 * A hanging editor opens wherever its opener is — at the foot of a long tab, that can be below what
 * the window shows. Opening it moves its scroll container just enough to show it, and no more.
 */
function layout({ viewTop = 0, viewBottom = 400, panelTop, panelBottom, scrollTop = 100 }) {
	const scroller = document.createElement("div");
	scroller.style.overflowY = "auto";
	const panel = document.createElement("div");
	scroller.appendChild(panel);
	document.body.appendChild(scroller);
	Object.defineProperty(scroller, "scrollHeight", { value: 2000 });
	Object.defineProperty(scroller, "clientHeight", { value: viewBottom - viewTop });
	scroller.scrollTop = scrollTop;
	scroller.getBoundingClientRect = () => ({ top: viewTop, bottom: viewBottom });
	panel.getBoundingClientRect = () => ({ top: panelTop, bottom: panelBottom });
	return { scroller, panel };
}

describe("revealInScroller", () => {
	it("scrolls down just far enough to show a panel that opens below the view", () => {
		const { scroller, panel } = layout({ panelTop: 350, panelBottom: 500 });
		revealInScroller(panel);
		expect(scroller.scrollTop).toBe(200);
	});

	// A panel taller than the view shows its top, where its first choice is.
	it("keeps the top of a panel taller than the view in sight", () => {
		const { scroller, panel } = layout({ panelTop: 300, panelBottom: 900 });
		revealInScroller(panel);
		expect(scroller.scrollTop).toBe(400);
	});

	it("scrolls up to a panel above the view", () => {
		const { scroller, panel } = layout({ panelTop: -50, panelBottom: 100 });
		revealInScroller(panel);
		expect(scroller.scrollTop).toBe(50);
	});

	it("leaves a panel already in view where it is", () => {
		const { scroller, panel } = layout({ panelTop: 50, panelBottom: 300 });
		revealInScroller(panel);
		expect(scroller.scrollTop).toBe(100);
	});

	it("does nothing for a panel with no scroll container", () => {
		const panel = document.createElement("div");
		document.body.appendChild(panel);
		expect(() => revealInScroller(panel)).not.toThrow();
	});
});
