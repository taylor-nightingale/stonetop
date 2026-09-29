// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { TabStripFit, TabStripWatch } from "../../src/utils/TabStripFit.js";

// Which tabs a strip shows whole, and which go into its "More" menu. Tabs never shrink, overlap or
// wrap: as many as fit are shown, in order, and the rest are listed under More — except the open
// tab, which always stays, the one before it going instead. Geometry is stubbed: happy-dom lays
// nothing out.

describe("TabStripFit.decide", () => {
	const decide = (widths, room, { more = 60, gap = 6, active = 0 } = {}) =>
		TabStripFit.decide(widths, room, more, gap, active);

	it("keeps every tab, and no More, while they all fit", () => {
		expect(decide([80, 80, 80], 252)).toEqual([false, false, false]);
	});

	it("keeps as many as fit beside More, in order, and sends the rest to it", () => {
		// room 300: More 60 + gap 6 leaves 234 → 80 + 6 + 80 = 166, a third would need 252.
		expect(decide([80, 80, 80, 80], 300)).toEqual([false, false, true, true]);
	});

	it("keeps the open tab, sending the one before it instead", () => {
		expect(decide([80, 80, 80, 80], 300, { active: 3 })).toEqual([false, true, true, false]);
	});

	it("keeps an open tab that would have fitted anyway where it is", () => {
		expect(decide([80, 80, 80, 80], 300, { active: 1 })).toEqual([false, false, true, true]);
	});

	it("keeps the open tab even where nothing else fits", () => {
		expect(decide([200, 200, 200], 150, { active: 2 })).toEqual([true, true, false]);
	});
});

const box = (el, width) => { el.getBoundingClientRect = () => ({ width, height: 30, left: 0, top: 0, right: width, bottom: 30 }); };

function strip({ room = 300, widths = [80, 80, 80, 80], active = 0, extra = 0 } = {}) {
	document.body.innerHTML = `
	<nav class="sheet-tabs tabs" style="column-gap: 6px; padding-left: 0; padding-right: 0">
		${widths.map((_, i) => `<button class="item${i === active ? " active" : ""}" data-tab="t${i}">T${i}</button>`).join("")}
		<div class="stonetop-tab-more" hidden>
			<button type="button" class="stonetop-tab-more-btn" aria-expanded="false">More</button>
			<div class="stonetop-tab-more-menu" hidden>
				${widths.map((_, i) => `<button class="stonetop-tab-more-item" data-tab="t${i}" hidden>T${i}</button>`).join("")}
			</div>
		</div>
		${extra ? `<button class="stonetop-advice-btn">?</button>` : ""}
	</nav>`;
	const nav = document.querySelector("nav");
	box(nav, room);
	[...nav.querySelectorAll(".item")].forEach((el, i) => box(el, widths[i]));
	box(nav.querySelector(".stonetop-tab-more"), 60);
	if (extra) box(nav.querySelector(".stonetop-advice-btn"), extra);
	return nav;
}

const shown = nav => [...nav.querySelectorAll(".item")].map(el => !el.hidden);
const listed = nav => [...nav.querySelectorAll(".stonetop-tab-more-item")].map(el => !el.hidden);
const more = nav => nav.querySelector(".stonetop-tab-more");

beforeEach(() => { document.body.innerHTML = ""; });

describe("TabStripFit on a strip", () => {
	it("hides the tabs that do not fit, lists them under More, and shows More", () => {
		const nav = strip();
		new TabStripFit(nav).fit();
		expect(shown(nav)).toEqual([true, true, false, false]);
		expect(listed(nav)).toEqual([false, false, true, true]);
		expect(more(nav).hidden).toBe(false);
	});

	it("shows every tab and no More where they all fit", () => {
		const nav = strip({ room: 400 });
		new TabStripFit(nav).fit();
		expect(shown(nav)).toEqual([true, true, true, true]);
		expect(more(nav).hidden).toBe(true);
	});

	it("measures again from scratch, so a widened strip takes its tabs back", () => {
		const nav = strip();
		const fit = new TabStripFit(nav);
		fit.fit();
		box(nav, 400);
		fit.fit();
		expect(shown(nav)).toEqual([true, true, true, true]);
		expect(listed(nav)).toEqual([false, false, false, false]);
	});

	// The steading's ? sits at the strip's end, and is room the tabs do not have.
	it("leaves room for what else the strip holds", () => {
		const nav = strip({ room: 400, extra: 60 });
		new TabStripFit(nav).fit();
		expect(shown(nav)).toEqual([true, true, true, false]);
	});
});

describe("TabStripWatch", () => {
	it("fits after a render, and again when the strip changes size", () => {
		const nav = strip();
		const observers = [];
		window.ResizeObserver = class { constructor(cb) { this.cb = cb; observers.push(this); } observe() {} disconnect() {} };
		const watch = new TabStripWatch();
		watch.watch(document.body);
		expect(shown(nav)).toEqual([true, true, false, false]);
		box(nav, 400);
		observers.at(-1).cb();
		expect(shown(nav)).toEqual([true, true, true, true]);
	});

	it("fits again when the open tab changes, without a render", () => {
		const nav = strip();
		const watch = new TabStripWatch();
		watch.watch(document.body);
		nav.querySelector(".active").classList.remove("active");
		nav.querySelector('[data-tab="t3"]').classList.add("active");
		watch.refit();
		expect(shown(nav)).toEqual([true, false, false, true]);
	});

	it("does nothing on a sheet with no strip", () => {
		document.body.innerHTML = "<div></div>";
		expect(() => new TabStripWatch().watch(document.body)).not.toThrow();
	});
});
