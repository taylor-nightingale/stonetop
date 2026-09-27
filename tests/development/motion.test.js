import { describe, it, expect, vi, afterEach } from "vitest";
import { slideHeight, slideOpen, SLIDE_MS } from "../../scripts/development/redesign-mock/motion.js";

/**
 * A box grows or shrinks between two heights given in pixels, the way the band folds: both ends
 * definite, the start laid out before the end is set, and the stylesheet given the box back after.
 */

/* A box whose laid-out height is its pinned height, or `natural` when nothing pins it. */
class FakeBox {
	constructor({ natural = 0, hidden = false } = {}) {
		this.natural = natural;
		this.hidden = hidden;
		this.heights = [];
		this.listeners = new Set();
		const heights = this.heights;
		this.style = new Proxy({}, {
			set(target, key, value) {
				if (key === "height") heights.push(value);
				target[key] = value;
				return true;
			},
		});
		this.reflows = 0;
	}

	get offsetHeight() {
		this.reflows++;
		if (this.hidden) return 0;
		return this.style.height ? parseFloat(this.style.height) : this.natural;
	}

	addEventListener(type, fn) { if (type === "transitionend") this.listeners.add(fn); }
	removeEventListener(type, fn) { if (type === "transitionend") this.listeners.delete(fn); }
	end(propertyName = "height", target = this) { for (const fn of [...this.listeners]) fn({ target, propertyName }); }
}

/* Whether a promise has settled, and with what, without waiting on a timer. */
const outcome = async promise => {
	let result = "pending";
	promise.then(value => { result = value; });
	await Promise.resolve();
	await Promise.resolve();
	return result;
};

afterEach(() => vi.useRealTimers());

describe("slideHeight", () => {
	it("lays out the start before setting the end, and eases the height between them", () => {
		const box = new FakeBox();
		slideHeight(box, 120, 300);
		expect(box.heights).toEqual(["120px", "300px"]);
		expect(box.reflows).toBeGreaterThan(0);
		expect(box.style.transition).toBe(`height ${SLIDE_MS}ms ease, padding ${SLIDE_MS}ms ease`);
		expect(box.style.overflow).toBe("clip");
	});

	it("gives the box back to the stylesheet when the height has finished easing", async () => {
		const box = new FakeBox();
		const done = slideHeight(box, 120, 300);
		box.end();
		expect(await outcome(done)).toBe(true);
		for (const key of ["height", "transition", "overflow", "boxSizing", "paddingTop", "paddingBottom"]) {
			expect(box.style[key] ?? "").toBe("");
		}
		expect(box.listeners.size).toBe(0);
	});

	// A box at zero has no padding either, or it stops at its padding and then snaps shut.
	it("eases the padding away on the way to zero", () => {
		const box = new FakeBox();
		slideHeight(box, 120, 0);
		expect([box.style.paddingTop, box.style.paddingBottom]).toEqual(["0px", "0px"]);
	});

	it("starts from no padding on the way up from zero, and eases to the stylesheet's", () => {
		const box = new FakeBox();
		const set = [];
		const style = box.style;
		box.style = new Proxy(style, { set(t, k, v) { if (k === "paddingTop") set.push(v); return Reflect.set(t, k, v); } });
		slideHeight(box, 0, 120);
		expect(set).toEqual(["0px", ""]);
	});

	it("leaves the padding alone between two heights", () => {
		const box = new FakeBox();
		slideHeight(box, 120, 300);
		expect(box.style.paddingTop ?? "").toBe("");
	});

	// A caret turning inside the box, or a colour easing on its bar, bubbles its own transitionend.
	it("is not finished by another property, or by something inside the box", async () => {
		const box = new FakeBox();
		const done = slideHeight(box, 120, 300);
		box.end("color");
		box.end("height", {});
		expect(await outcome(done)).toBe("pending");
		expect(box.style.height).toBe("300px");
	});

	it("finishes on its own if the transition never reports its end", async () => {
		vi.useFakeTimers();
		const box = new FakeBox();
		const done = slideHeight(box, 120, 300);
		vi.advanceTimersByTime(SLIDE_MS + 100);
		expect(await outcome(done)).toBe(true);
		expect(box.style.height).toBe("");
	});

	// Pressing again mid-way starts from wherever the box has got to; the first slide's ending must
	// not reach in and undo the second, and it says it did not finish.
	it("hands the box over to a second slide started before the first has finished", async () => {
		vi.useFakeTimers();
		const box = new FakeBox();
		const first = slideHeight(box, 120, 300);
		slideHeight(box, 200, 0);
		expect(await outcome(first)).toBe(false);
		vi.advanceTimersByTime(SLIDE_MS / 2);
		expect(box.style.height).toBe("0px");
	});

	it("moves nothing when motion is reduced, or when there is no distance to go", async () => {
		for (const [from, to, reduced] of [[120, 300, true], [200, 200, false]]) {
			const box = new FakeBox();
			expect(await outcome(slideHeight(box, from, to, { reduced }))).toBe(true);
			expect(box.heights).toEqual([]);
		}
	});
});

describe("slideOpen", () => {
	it("shows a hidden box and grows it from nothing to its own height", async () => {
		const box = new FakeBox({ natural: 180, hidden: true });
		const done = slideOpen(box, true);
		expect(box.hidden).toBe(false);
		expect(box.heights).toEqual(["", "0px", "180px"]);
		box.end();
		await outcome(done);
		expect(box.hidden).toBe(false);
	});

	it("keeps a shutting box on the page until it has slid away, then hides it", async () => {
		const box = new FakeBox({ natural: 180 });
		const done = slideOpen(box, false);
		expect(box.hidden).toBe(false);
		expect(box.heights).toEqual(["", "180px", "0px"]);
		box.end();
		await outcome(done);
		expect(box.hidden).toBe(true);
	});

	it("does not hide a box that was opened again before it finished shutting", async () => {
		const box = new FakeBox({ natural: 180 });
		let open = false;
		const shutting = slideOpen(box, false, { stillOpen: () => open });
		open = true;
		slideOpen(box, true, { stillOpen: () => open });
		await outcome(shutting);
		expect(box.hidden).toBe(false);
	});

	// A box caught mid-slide still carries the pinned height; its own height is measured without it.
	it("measures where it is going with the last slide's pin taken off", () => {
		const box = new FakeBox({ natural: 180 });
		slideOpen(box, false);
		box.style.height = "90px";
		box.heights.length = 0;
		slideOpen(box, true);
		expect(box.heights).toEqual(["", "90px", "180px"]);
	});

	it("hides at once when motion is reduced", async () => {
		const box = new FakeBox({ natural: 180 });
		await outcome(slideOpen(box, false, { reduced: true }));
		expect(box.hidden).toBe(true);
		expect(box.heights).toEqual([""]);
	});
});
