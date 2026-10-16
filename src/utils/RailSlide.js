import { SLIDE_MS } from "./motion.js";

/* The slide in progress on a layout, so a second press can take it over mid-way. */
const SLIDING_MARGINS = new Set(["margin-left", "margin-right"]);

const RUNNING = new WeakMap();

/**
 * A column rail's slide: `is-rail-moving` on its layout from the press until the rail's margin has
 * finished easing.
 *
 * The mark is for the stylesheet, which holds the column beside the rail at one width while it is
 * on. Easing the rail's margin eased the column's WIDTH, so the whole tab was laid out again on
 * every frame — the steading's line re-wrapped and changed height, notes came and went at their
 * thresholds, and everything under it jumped. Held, the column is laid out once and only slides.
 *
 * The timer covers a transition that never reports its end — a rail re-rendered away mid-slide.
 */
export class RailSlide {
	static MOVING = "is-rail-moving";

	/**
	 * @param {HTMLElement} layout the rail layout
	 * @param {object} [options]
	 * @param {boolean} [options.reduced] whether motion is reduced; read off the page when not given
	 */
	constructor(layout, { reduced } = {}) {
		this._layout = layout;
		this._reduced = reduced ?? prefersReducedMotion(layout);
	}

	start() {
		RUNNING.get(this._layout)?.();
		if (this._reduced) return;
		const rail = this._layout.querySelector(":scope > .stonetop-rail");
		const finish = () => {
			stop();
			this._layout.classList.remove(RailSlide.MOVING);
		};
		// A start-edge rail slides on its left margin, an end-edge one on its right.
		const onEnd = e => { if (e.target === rail && SLIDING_MARGINS.has(e.propertyName)) finish(); };
		const timer = setTimeout(finish, SLIDE_MS + 100);
		const stop = () => {
			clearTimeout(timer);
			rail?.removeEventListener("transitionend", onEnd);
			RUNNING.delete(this._layout);
		};
		RUNNING.set(this._layout, stop);
		rail?.addEventListener("transitionend", onEnd);
		this._layout.classList.add(RailSlide.MOVING);
	}
}

const prefersReducedMotion = el =>
	Boolean(el.ownerDocument?.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
