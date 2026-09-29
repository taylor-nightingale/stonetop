import { SLIDE_MS } from "./motion.js";

/**
 * The character band folding, on one curve (P9): the numbers and the ailments ease away to nothing
 * while the line they fold to eases in, and the other way round. The rail slides; a band that
 * vanished beside it was a second way of saying "this region is going away", and one that blinked.
 *
 * Both ends are pixels read off the live boxes, the way motion.js slides everything else — easing to
 * or from `auto` re-derives the size every frame and stutters. The current size is read before
 * anything moves, so a second press mid-way starts from wherever the band is. The width eases as well
 * as the height, because the stats' width is what hands the foot its full line.
 *
 * The fold itself (the class) lands at once, so the toggle and the sheet's memory say the new state
 * straight away; `is-band-moving` keeps both densities drawn until the motion is done, and then every
 * box is handed back to the stylesheet.
 */
export class BandFold {
	static MOVING = "is-band-moving";
	static PARTS  = [":scope > .sheet-top", ":scope > .stonetop-ailments"];
	static LINE   = ".stonetop-folded-ledger";

	/** @param {TopBand} band */
	constructor(band) {
		this._band = band;
	}

	/** Fold (`collapse`) or unfold. Nothing moves under reduced motion. */
	run(collapse, { reduced = false } = {}) {
		const wrapper = this._band.wrapper;
		const band = wrapper.querySelector(".stonetop-band");
		if (reduced || !band) {
			this._band.setCollapsed(collapse);
			return;
		}
		RUNNING.get(wrapper)?.();
		const parts = BandFold.PARTS.map(sel => band.querySelector(sel)).filter(Boolean);
		const line = band.querySelector(BandFold.LINE);

		const partsFrom = parts.map(sizeOf);
		const lineFrom = line?.offsetHeight ?? 0;
		for (const el of [...parts, line].filter(Boolean)) release(el);
		wrapper.classList.add(BandFold.MOVING);
		this._band.setCollapsed(collapse);
		const partsTo = collapse ? parts.map(() => ZERO) : parts.map(sizeOf);
		const lineTo = collapse ? (line?.offsetHeight ?? 0) : 0;

		parts.forEach((el, i) => pin(el, partsFrom[i], collapse ? 1 : 0));
		if (line) pinHeight(line, lineFrom);
		void band.offsetHeight;

		for (const el of parts) el.style.transition = `width ${SLIDE_MS}ms ease, height ${SLIDE_MS}ms ease, opacity ${SLIDE_MS}ms ease`;
		if (line) line.style.transition = `height ${SLIDE_MS}ms ease`;
		parts.forEach((el, i) => pin(el, partsTo[i], collapse ? 0 : 1));
		if (line) pinHeight(line, lineTo);

		const settle = () => {
			clearTimeout(timer);
			RUNNING.delete(wrapper);
			for (const el of [...parts, line].filter(Boolean)) release(el);
			wrapper.classList.remove(BandFold.MOVING);
		};
		const timer = setTimeout(settle, SLIDE_MS + 100);
		RUNNING.set(wrapper, () => clearTimeout(timer));
	}
}

/* The fold in progress on a band, so a second press can take it over. */
const RUNNING = new WeakMap();

const ZERO = { w: 0, h: 0 };
const sizeOf = el => ({ w: el.offsetWidth, h: el.offsetHeight });

const pin = (el, { w, h }, opacity) => {
	el.style.boxSizing = "border-box";
	el.style.overflow = "clip";
	el.style.width = `${w}px`;
	el.style.height = `${h}px`;
	el.style.opacity = String(opacity);
};

const pinHeight = (el, h) => {
	el.style.overflow = "clip";
	el.style.height = `${h}px`;
};

const release = el => {
	for (const prop of ["boxSizing", "overflow", "width", "height", "opacity", "transition"]) el.style[prop] = "";
};
