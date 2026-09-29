// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { BandFold } from "../../src/utils/BandFold.js";
import { TopBand } from "../../src/utils/TopBand.js";
import { SLIDE_MS } from "../../src/utils/motion.js";

// The band folding on one curve (P9): the numbers and the ailments ease away while the line they fold
// to eases in, and back. Both ends are pixels read off the live boxes. happy-dom lays nothing out, so
// each box's size is given.

function mount({ collapsed = false } = {}) {
	document.body.innerHTML = `
	<div class="sheet-wrapper${collapsed ? " top-collapsed" : ""}">
		<div class="stonetop-band">
			<section class="sheet-top" id="s1-band"></section>
			<section class="stonetop-ailments"></section>
			<div class="stonetop-band-foot"><div class="stonetop-folded-ledger"></div></div>
		</div>
		<button type="button" class="stonetop-top-toggle" aria-expanded="true"></button>
	</div>`;
	const wrapper = document.querySelector(".sheet-wrapper");
	const q = s => wrapper.querySelector(s);
	return { wrapper, band: new TopBand(wrapper), stats: q(".sheet-top"), ailments: q(".stonetop-ailments"), ledger: q(".stonetop-folded-ledger") };
}

// A box's size: its natural one unless something has pinned it.
const sized = (el, w, h) => {
	const read = (prop, natural) => () => (el.style[prop] ? parseFloat(el.style[prop]) : natural);
	Object.defineProperty(el, "offsetWidth", { get: read("width", w), configurable: true });
	Object.defineProperty(el, "offsetHeight", { get: read("height", h), configurable: true });
};

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ""; });

describe("BandFold, folding", () => {
	it("folds at once, so the toggle and the sheet's memory see the new state straight away", () => {
		const { wrapper, band } = mount();
		new BandFold(band).run(true);
		expect(wrapper.classList.contains("top-collapsed")).toBe(true);
	});

	it("eases the numbers and the ailments from their open size to nothing", () => {
		const { band, stats, ailments } = mount();
		sized(stats, 460, 180);
		sized(ailments, 300, 90);
		new BandFold(band).run(true);
		for (const el of [stats, ailments]) {
			expect([el.style.width, el.style.height, el.style.opacity]).toEqual(["0px", "0px", "0"]);
			expect(el.style.transition).toContain(`${SLIDE_MS}ms`);
		}
	});

	it("eases the line in from nothing to its own height", () => {
		const { band, ledger } = mount();
		sized(ledger, 600, 24);
		new BandFold(band).run(true);
		expect(ledger.style.height).toBe("24px");
		expect(ledger.style.transition).toContain("height");
	});

	it("keeps both densities drawn while it moves, and hands every box back to the stylesheet after", () => {
		const { wrapper, band, stats, ledger } = mount();
		sized(stats, 460, 180);
		sized(ledger, 600, 24);
		new BandFold(band).run(true);
		expect(wrapper.classList.contains(BandFold.MOVING)).toBe(true);
		vi.advanceTimersByTime(SLIDE_MS + 100);
		expect(wrapper.classList.contains(BandFold.MOVING)).toBe(false);
		expect([stats.style.width, stats.style.height, stats.style.opacity, stats.style.transition]).toEqual(["", "", "", ""]);
		expect(ledger.style.height).toBe("");
	});
});

describe("BandFold, unfolding", () => {
	it("eases the numbers and the ailments from nothing to their open size", () => {
		const { wrapper, band, stats } = mount({ collapsed: true });
		sized(stats, 460, 180);
		new BandFold(band).run(false);
		expect(wrapper.classList.contains("top-collapsed")).toBe(false);
		expect([stats.style.width, stats.style.height, stats.style.opacity]).toEqual(["460px", "180px", "1"]);
	});

	it("eases the line out to nothing", () => {
		const { band, ledger } = mount({ collapsed: true });
		sized(ledger, 600, 24);
		new BandFold(band).run(false);
		expect(ledger.style.height).toBe("0px");
	});
});

describe("BandFold, pressed again mid-way", () => {
	it("lets the second fold keep the band, rather than the first one's timer releasing it early", () => {
		const { wrapper, band, stats } = mount();
		sized(stats, 460, 180);
		new BandFold(band).run(true);
		vi.advanceTimersByTime(SLIDE_MS / 2);
		new BandFold(band).run(false);
		vi.advanceTimersByTime(SLIDE_MS / 2 + 100);
		expect(wrapper.classList.contains(BandFold.MOVING)).toBe(true);
		expect(stats.style.width).toBe("460px");
		vi.advanceTimersByTime(SLIDE_MS);
		expect(wrapper.classList.contains(BandFold.MOVING)).toBe(false);
	});
});

describe("BandFold, with less motion asked for", () => {
	it("folds and unfolds without moving anything", () => {
		const { wrapper, band, stats } = mount();
		sized(stats, 460, 180);
		new BandFold(band).run(true, { reduced: true });
		expect(wrapper.classList.contains("top-collapsed")).toBe(true);
		expect(wrapper.classList.contains(BandFold.MOVING)).toBe(false);
		expect(stats.style.width).toBe("");
	});
});
