// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { BandFootFit, BandFootWatch } from "../../src/utils/BandFootFit.js";

// How the band's foot — the roll mode and the fold control — keeps to its column beside the stats.
// It never goes under them: the fold control drops its word first, and where even that does not fit
// the line wraps inside its own column. Measured, because what it needs is its words, which
// translate, and what it gets depends on whether the rail is a column. Geometry is stubbed:
// happy-dom lays nothing out.

const box = (el, width) => { el.getBoundingClientRect = () => ({ width, height: 10, left: 0, top: 0, right: width, bottom: 10 }); };

// The toggle is drawn narrower while the band says compact, the way the stylesheet draws it — so a
// fit that decides without putting the band in the state it is measuring gets the wrong number.
function band({ bandWidth = 900, statsWidth = 450, nameWidth = 300, mode = 200, toggle = 60, caret = 24, folded = false, gap = 16, footGap = 8 } = {}) {
	document.body.innerHTML = `
	<div class="sheet-wrapper${folded ? " top-collapsed" : ""}">
		<div class="stonetop-band" style="padding-left: 16px; padding-right: 16px; column-gap: ${gap}px">
			<header class="stonetop-masthead"><div class="stonetop-masthead-id"></div></header>
			<section class="sheet-top"><div class="stonetop-stats-column"></div></section>
			<div class="stonetop-band-foot" style="column-gap: ${footGap}px">
				<span class="hidden-ledger"></span>
				<span class="mode"></span>
				<span class="toggle"></span>
			</div>
		</div>
	</div>`;
	const el = document.querySelector(".stonetop-band");
	box(el, bandWidth);
	box(el.querySelector(".sheet-top"), 0);
	box(el.querySelector(".stonetop-stats-column"), statsWidth);
	box(el.querySelector(".stonetop-masthead-id"), nameWidth);
	box(el.querySelector(".hidden-ledger"), 0);
	box(el.querySelector(".mode"), mode);
	const t = el.querySelector(".toggle");
	t.getBoundingClientRect = () => {
		const width = el.classList.contains(BandFootFit.COMPACT_CLASS) ? caret : toggle;
		return { width, height: 10, left: 0, top: 0, right: width, bottom: 10 };
	};
	return el;
}

const classes = el => [BandFootFit.COMPACT_CLASS, BandFootFit.WRAPPED_CLASS].filter(c => el.classList.contains(c));

beforeEach(() => { document.body.innerHTML = ""; });

describe("BandFootFit.decide", () => {
	it("keeps the whole line while it fits", () => {
		expect(BandFootFit.decide(300, 250, 300)).toBe(BandFootFit.FULL);
	});

	it("drops the fold control's word once the whole line does not fit", () => {
		expect(BandFootFit.decide(301, 250, 300)).toBe(BandFootFit.COMPACT);
		expect(BandFootFit.decide(301, 300, 300)).toBe(BandFootFit.COMPACT);
	});

	it("wraps the line in its own column once even that does not fit", () => {
		expect(BandFootFit.decide(400, 301, 300)).toBe(BandFootFit.WRAPPED);
	});

	it("allows half a pixel of slack", () => {
		expect(BandFootFit.decide(300.5, 250, 300)).toBe(BandFootFit.FULL);
	});
});

describe("BandFootFit#fit", () => {
	// 900 - 32 padding - 450 stats - 16 gap = 402 of room; 200 + 60 + 8 = 268 needed.
	it("keeps the whole line beside the stats when it fits there", () => {
		const el = band();
		expect(new BandFootFit(el).fit()).toBe(BandFootFit.FULL);
		expect(classes(el)).toEqual([]);
	});

	// 750 leaves 252: short of the 268 the whole line needs, past the 232 it needs compact.
	it("drops the fold control's word where the whole line does not fit", () => {
		const el = band({ bandWidth: 750 });
		expect(new BandFootFit(el).fit()).toBe(BandFootFit.COMPACT);
		expect(classes(el)).toEqual([BandFootFit.COMPACT_CLASS]);
	});

	// 700 leaves 202: short of the compact 232. Wrapped is compact too — the caret goes to its own line.
	it("wraps the line in its own column where even that does not fit — never under the stats", () => {
		const el = band({ bandWidth: 700 });
		expect(new BandFootFit(el).fit()).toBe(BandFootFit.WRAPPED);
		expect(classes(el)).toEqual([BandFootFit.COMPACT_CLASS, BandFootFit.WRAPPED_CLASS]);
	});

	// Measured in the state it is deciding about: a band left compact by the last answer still has
	// its whole line measured whole, or it could never come back.
	it("measures the whole line whole, whatever state the band was left in", () => {
		const el = band();
		el.classList.add(BandFootFit.COMPACT_CLASS, BandFootFit.WRAPPED_CLASS);
		expect(new BandFootFit(el).fit()).toBe(BandFootFit.FULL);
		expect(classes(el)).toEqual([]);
	});

	// The first column is the wider of the stats and the name, and the fold eases the stats' box —
	// so neither box is what is measured, only what is in them.
	it("gives the foot what is left of the wider of the stats and the name", () => {
		// 900 - 32 - 600 - 16 = 252: compact, where the stats alone would have left the whole line room.
		const el = band({ statsWidth: 300, nameWidth: 600 });
		expect(new BandFootFit(el).fit()).toBe(BandFootFit.COMPACT);
	});

	it("gives the word back once there is room again", () => {
		const el = band({ bandWidth: 700 });
		const fit = new BandFootFit(el);
		fit.fit();
		box(el, 900);
		expect(fit.fit()).toBe(BandFootFit.FULL);
		expect(classes(el)).toEqual([]);
	});

	// The line the band folds to is not on the foot while the band is open, so it is not counted.
	// 200 + 194 + one 8px gap is exactly the 402 there is; a second gap for the ledger would not fit.
	it("counts only what is drawn", () => {
		expect(new BandFootFit(band({ toggle: 194 })).fit()).toBe(BandFootFit.FULL);
	});

	// Folded there is no stats column to be beside, so the question is not asked, and the answer the
	// open band last gave stands.
	it("leaves the answer alone while the band is folded", () => {
		const el = band({ bandWidth: 700, folded: true });
		el.classList.add(BandFootFit.COMPACT_CLASS);
		box(el, 2000);
		expect(new BandFootFit(el).fit()).toBeNull();
		expect(classes(el)).toEqual([BandFootFit.COMPACT_CLASS]);
	});
});

describe("BandFootFit#apply", () => {
	it("puts a remembered answer back on a freshly rendered band", () => {
		const el = band();
		const fit = new BandFootFit(el);
		fit.apply(BandFootFit.WRAPPED);
		expect(classes(el)).toEqual([BandFootFit.COMPACT_CLASS, BandFootFit.WRAPPED_CLASS]);
		fit.apply(BandFootFit.COMPACT);
		expect(classes(el)).toEqual([BandFootFit.COMPACT_CLASS]);
		fit.apply(BandFootFit.FULL);
		expect(classes(el)).toEqual([]);
	});
});

describe("BandFootWatch", () => {
	it("puts the open band's last answer back on a freshly rendered band", () => {
		const watch = new BandFootWatch();
		watch.watch(band({ bandWidth: 750 }).closest(".sheet-wrapper"));
		const fresh = band({ folded: true });
		watch.restore(fresh.closest(".sheet-wrapper"));
		expect(classes(fresh)).toEqual([BandFootFit.COMPACT_CLASS]);
	});

	it("keeps the last open answer while the band is folded", () => {
		const watch = new BandFootWatch();
		watch.watch(band({ bandWidth: 700 }).closest(".sheet-wrapper"));
		watch.watch(band({ folded: true }).closest(".sheet-wrapper"));
		const fresh = band();
		watch.restore(fresh.closest(".sheet-wrapper"));
		expect(classes(fresh)).toEqual([BandFootFit.COMPACT_CLASS, BandFootFit.WRAPPED_CLASS]);
	});

	it("starts with the whole line", () => {
		const fresh = band();
		fresh.classList.add(BandFootFit.COMPACT_CLASS);
		new BandFootWatch().restore(fresh.closest(".sheet-wrapper"));
		expect(classes(fresh)).toEqual([]);
	});

	it("asks again when the band is resized", () => {
		const callbacks = [];
		const view = document.defaultView;
		const original = view.ResizeObserver;
		view.ResizeObserver = class { constructor(cb) { callbacks.push(cb); } observe() {} disconnect() {} };
		try {
			const el = band();
			new BandFootWatch().watch(el.closest(".sheet-wrapper"));
			expect(classes(el)).toEqual([]);
			box(el, 750);
			callbacks.at(-1)();
			expect(classes(el)).toEqual([BandFootFit.COMPACT_CLASS]);
		} finally {
			view.ResizeObserver = original;
		}
	});

	it("stops watching the band a render replaced", () => {
		const disconnected = [];
		const view = document.defaultView;
		const original = view.ResizeObserver;
		view.ResizeObserver = class { observe() {} disconnect() { disconnected.push(true); } };
		try {
			const watch = new BandFootWatch();
			watch.watch(band().closest(".sheet-wrapper"));
			watch.watch(band().closest(".sheet-wrapper"));
			expect(disconnected).toHaveLength(1);
		} finally {
			view.ResizeObserver = original;
		}
	});
});
