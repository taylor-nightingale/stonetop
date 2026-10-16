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

/**
 * Bring a panel's TOP into view, and only when the reader has scrolled past it — for a panel shown in
 * place of another where the reader is already looking. Never scrolls down: a panel taller than the
 * view would otherwise pull everything beside it away.
 */
export function revealTopInScroller(panel) {
	const scroller = nearestScroller(panel);
	if (!scroller) return;
	const above = scroller.getBoundingClientRect().top - panel.getBoundingClientRect().top;
	if (above > 0) scroller.scrollTop -= above;
}

function nearestScroller(element) {
	for (let node = element.parentElement; node; node = node.parentElement) {
		const overflow = getComputedStyle(node).overflowY;
		if ((overflow === "auto" || overflow === "scroll") && node.scrollHeight > node.clientHeight) return node;
	}
	return null;
}
