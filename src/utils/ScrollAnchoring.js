import { ScrollAnchor } from "./ScrollAnchor.js";

/**
 * Holds a ScrollAnchor for the whole of an action, rather than for one render.
 *
 * One render is not enough to anchor against. An action that writes twice — flipping an arcanum
 * updates the card AND adds/removes the gear that side grants — renders twice, and the second
 * render can begin before the first has finished restoring: it then captures the mid-swap scroll
 * position (0, because a container that has not been laid out yet clamps the assignment) and
 * restores that instead. So the anchor is held for the whole action rather than consumed by the
 * first render. Re-applying is idempotent — once the element is back where it was the correction
 * is 0 — so the extra passes cost nothing.
 */
export class ScrollAnchoring {
	#anchor = null;

	/**
	 * Run `work` (an action's writes) while keeping `element` visually still, however many renders
	 * those writes cause.
	 *
	 * Released a tick after the writes settle, since the last render they trigger is not awaited by
	 * the write itself.
	 */
	async hold(element, anchorSelector, containerSelector, work) {
		this.#anchor = ScrollAnchor.capture(element, anchorSelector, containerSelector);
		try {
			return await work();
		} finally {
			setTimeout(() => { this.#anchor = null; }, 0);
		}
	}

	/** Re-apply the held anchor, if any, within a freshly rendered root. */
	applyTo(root) {
		this.#anchor?.restore(root);
	}
}
