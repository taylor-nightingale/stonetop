/**
 * A sheet's persistent side rail, and the drawer it becomes when the sheet is too narrow to seat it.
 *
 * The rail is an inline column at wide widths, so opening and closing is meaningless there and the
 * toggle is hidden. Below the layout's breakpoint it slides over the tab, and then it is a
 * disclosure like any other: one button, `aria-expanded`, focus moved in on open and put back on
 * close (WCAG 2.2 SC 2.4.11 — a drawer that overlays content must not strand the focus behind it).
 *
 * Side-agnostic. Which edge the rail is on is `data-side` on the layout, read by the stylesheet;
 * nothing here knows or cares, so a second sheet gets a rail by writing the markup.
 */
export class SheetRail {
	/** The rail owning `target`, or null when the control is not inside a rail layout. */
	static from(target) {
		const layout = target?.closest?.(".stonetop-rail-layout");
		return layout ? new SheetRail(layout) : null;
	}

	constructor(layout) {
		this._layout = layout;
	}

	get isOpen() {
		return this._layout.classList.contains("rail-open");
	}

	get _toggle() {
		return this._layout.querySelector(".stonetop-rail-toggle");
	}

	get _rail() {
		return this._layout.querySelector(".stonetop-rail");
	}

	open() {
		this._layout.classList.add("rail-open");
		this._toggle?.setAttribute("aria-expanded", "true");
		// The rail's own first control, not the rail itself: a tabindex="-1" container would take
		// the focus and then hand it straight back to the tab behind on the next Tab press.
		this._rail?.querySelector(FOCUSABLE)?.focus();
	}

	close() {
		this._layout.classList.remove("rail-open");
		this._toggle?.setAttribute("aria-expanded", "false");
		// Back to the button that opened it. Only when the focus is still inside the rail — closing
		// because a move sheet opened must not pull the focus off that sheet.
		if (this._rail?.contains(document.activeElement)) this._toggle?.focus();
	}

	toggle() {
		if (this.isOpen) this.close();
		else this.open();
	}
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The rail toggle, as an ApplicationV2 actions entry. Pure view state — no actor write — so it is
 * not gated on editability and its button carries `data-view-state` to survive a locked sheet.
 */
export const RAIL_ACTIONS = {
	toggleRail(ev, target) {
		SheetRail.from(target)?.toggle();
	},
};
