/**
 * Bring a just-opened panel into view within its own scroll container — just far enough, and no
 * further. A panel taller than the view keeps its top in sight, where its first control is.
 *
 * Not `scrollIntoView`, which scrolls every scrollable ancestor, the window's own included; only the
 * container the panel scrolls in is moved.
 */
export function revealInScroller(panel) {
	const scroller = nearestScroller(panel);
	if (!scroller) return;
	const box  = panel.getBoundingClientRect();
	const view = scroller.getBoundingClientRect();
	if (box.top < view.top) scroller.scrollTop -= view.top - box.top;
	else if (box.bottom > view.bottom) scroller.scrollTop += Math.min(box.bottom - view.bottom, box.top - view.top);
}

function nearestScroller(element) {
	for (let node = element.parentElement; node; node = node.parentElement) {
		const overflow = getComputedStyle(node).overflowY;
		if ((overflow === "auto" || overflow === "scroll") && node.scrollHeight > node.clientHeight) return node;
	}
	return null;
}
