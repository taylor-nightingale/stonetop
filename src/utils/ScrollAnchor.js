/**
 * Keeps one element visually still across a re-render that replaces the scroll container's content.
 *
 * ApplicationV2 restores `scrollTop` from inside `_replaceHTML` — before the new content has been laid
 * out. Assigning to a container whose `scrollHeight` is still ~0 clamps to 0, and nothing re-applies it
 * afterwards, so a re-render that rewrites a large part of the tab lands back at the top. A capture
 * taken BEFORE the write, re-applied after the render, survives that.
 *
 * Anchoring to an element rather than to a raw `scrollTop` also survives a height change: flipping an
 * arcanum swaps its whole card body, so every card below it moves — the card the player clicked stays
 * where it was on screen instead of the scroll offset staying numerically equal.
 */
export class ScrollAnchor {
	/**
	 * Capture `anchor`'s position within its scroll container.
	 * @param {Element|null} anchor          the element to keep still
	 * @param {string} anchorSelector        re-finds it in the re-rendered DOM (it is a new node)
	 * @param {string} containerSelector     the scroll container, an ancestor of `anchor`
	 * @returns {ScrollAnchor|null}          null when there is nothing to keep still
	 */
	static capture(anchor, anchorSelector, containerSelector) {
		const container = anchor?.closest?.(containerSelector);
		if (!container) return null;
		const offset = anchor.getBoundingClientRect().top - container.getBoundingClientRect().top;
		return new ScrollAnchor(anchorSelector, containerSelector, offset, container.scrollTop);
	}

	constructor(anchorSelector, containerSelector, offset, scrollTop) {
		this.anchorSelector = anchorSelector;
		this.containerSelector = containerSelector;
		this.offset = offset;
		this.scrollTop = scrollTop;
	}

	/** Put the container back where it was, within the re-rendered `root`. */
	restore(root) {
		const container = root?.querySelector?.(this.containerSelector);
		if (!container) return;
		const anchor = container.querySelector(this.anchorSelector);
		// The anchor can be gone entirely (a card deleted, a tab switched out from under the write);
		// the raw offset is then the best we can do.
		if (!anchor) { container.scrollTop = this.scrollTop; return; }
		container.scrollTop += (anchor.getBoundingClientRect().top - container.getBoundingClientRect().top) - this.offset;
	}
}
