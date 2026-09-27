/**
 * How the sheet opens and shuts a box: a section at its door, a list at its Change, a rail group at
 * its caret. The band's fold is the model — both ends in pixels, the start laid out before the end is
 * set — because easing to or from `auto` made the browser re-derive the size on every frame and the
 * fold stuttered. Same duration as the fold and the rail's slide, so the sheet opens things one way.
 */

export const SLIDE_MS = 400;

/* The slide in progress on a box, so a second press can take the box over mid-way. */
const RUNNING = new WeakMap();

const release = el => {
	el.style.height = "";
	el.style.paddingTop = "";
	el.style.paddingBottom = "";
	el.style.overflow = "";
	el.style.boxSizing = "";
	el.style.transition = "";
};

/* A box at zero has no padding either: a move's text sits in ten pixels of it, and a slide to zero
   stopped there and snapped shut. */
const setPadding = (el, px) => {
	const value = px === 0 ? "0px" : "";
	el.style.paddingTop = value;
	el.style.paddingBottom = value;
};

/**
 * Eases `el` from `fromPx` tall to `toPx`, clipping what it holds rather than reflowing it, then hands
 * the box back to the stylesheet. Resolves `true` when the box is its own again, or `false` when a
 * second slide took it over first — the second slide's ending is the one that counts.
 *
 * `border-box` so the pixels measured with `offsetHeight` are the pixels set; the timer is for a
 * transition that never reports its end — a box taken out of the page mid-way does not.
 */
export function slideHeight(el, fromPx, toPx, { reduced = false } = {}) {
	RUNNING.get(el)?.();
	if (reduced || fromPx === toPx) return Promise.resolve(true);
	return new Promise(resolve => {
		const finish = () => {
			clearTimeout(timer);
			el.removeEventListener("transitionend", onEnd);
			RUNNING.delete(el);
			release(el);
			resolve(true);
		};
		const handOver = () => {
			clearTimeout(timer);
			el.removeEventListener("transitionend", onEnd);
			resolve(false);
		};
		const onEnd = e => { if (e.target === el && e.propertyName === "height") finish(); };
		const timer = setTimeout(finish, SLIDE_MS + 100);
		RUNNING.set(el, handOver);

		el.style.transition = "none";
		el.style.boxSizing = "border-box";
		el.style.overflow = "clip";
		el.style.height = `${fromPx}px`;
		if (fromPx === 0) setPadding(el, 0);
		void el.offsetHeight;
		el.addEventListener("transitionend", onEnd);
		el.style.transition = `height ${SLIDE_MS}ms ease, padding ${SLIDE_MS}ms ease`;
		el.style.height = `${toPx}px`;
		if (fromPx === 0 || toPx === 0) setPadding(el, toPx);
	});
}

/**
 * Opens or shuts a box that is shown and hidden with `hidden` — a rail group, a move's text. It stays
 * on the page while it slides shut and takes `hidden` at the end, unless `stillOpen` says it was
 * opened again meanwhile. Where it is going is measured with any slide in progress taken off it, or a
 * box caught half-open would take the half for its whole height.
 */
export function slideOpen(body, opening, { reduced = false, stillOpen = () => opening } = {}) {
	const from = body.hidden ? 0 : body.offsetHeight;
	release(body);
	body.hidden = false;
	const to = opening ? body.offsetHeight : 0;
	return slideHeight(body, from, to, { reduced }).then(finished => {
		if (finished) body.hidden = !stillOpen();
	});
}
