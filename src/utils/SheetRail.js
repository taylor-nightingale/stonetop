/**
 * A sheet's persistent side rail, and the drawer it becomes when the sheet is too narrow to seat it.
 *
 * Showing or putting away the rail is the reader's call at every width. Below the layout's
 * breakpoint the rail is an overlay the toggle slides over the tab; above it the rail is an inline
 * column that the toggle removes outright, giving the tab the whole sheet. One control, one
 * `aria-expanded`, and the same disclosure manners either way: focus moved in on open and put back
 * on close (WCAG 2.2 SC 2.4.11 — a drawer that overlays content must not strand the focus behind
 * it).
 *
 * State is three-valued on purpose. `rail-open` and `rail-shut` are what the READER has said; with
 * neither, the rail is however the width has it — inline above the breakpoint, drawered below. That
 * is what lets the template render no class at all and still be right at both widths, with nothing
 * having to measure anything before the first paint.
 *
 * Which of the two the width means is a question only the stylesheet can answer, so it is asked of
 * the stylesheet: a drawered rail is positioned over the tab, an inline one is in flow. Nothing here
 * repeats the breakpoint.
 *
 * Side-agnostic. Which edge the rail is on is `data-side` on the layout, read by the stylesheet;
 * nothing here knows or cares, so a second sheet gets a rail by writing the markup.
 */
export class SheetRail {
	static LAYOUT = ".stonetop-rail-layout";
	static OPEN   = "rail-open";
	static SHUT   = "rail-shut";

	/** The rail owning `target`, or null when the control is not inside a rail layout. */
	static from(target) {
		const layout = target?.closest?.(SheetRail.LAYOUT);
		return layout ? new SheetRail(layout) : null;
	}

	constructor(layout) {
		this._layout = layout;
	}

	/**
	 * What identifies this rail to anything outside its own DOM — the id of the region the toggle
	 * controls, which the template mints per sheet. Same key idea as a disclosure's.
	 */
	get key() {
		return this._rail?.id ?? "";
	}

	/** Whether the rail is currently an overlay rather than a column: the stylesheet's answer. */
	get isDrawer() {
		const rail = this._rail;
		const view = rail?.ownerDocument?.defaultView;
		return Boolean(rail && view?.getComputedStyle(rail).position === "absolute");
	}

	get isOpen() {
		if (this._layout.classList.contains(SheetRail.OPEN)) return true;
		if (this._layout.classList.contains(SheetRail.SHUT)) return false;
		// Untouched: whatever the width means. A column is showing; a drawer is not.
		return !this.isDrawer;
	}

	get _toggle() {
		return this._layout.querySelector(".stonetop-rail-toggle");
	}

	get _rail() {
		return this._layout.querySelector(".stonetop-rail");
	}

	/**
	 * Say what the rail now is, and nothing else. This is the restore path — putting a freshly
	 * rendered rail back the way its reader left it must not move anybody's focus.
	 */
	setOpen(open) {
		this._layout.classList.toggle(SheetRail.OPEN, open);
		this._layout.classList.toggle(SheetRail.SHUT, !open);
		this.syncToggle();
	}

	/**
	 * Make the toggle say what the rail actually is — the state it announces, and the thing pressing
	 * it will do.
	 *
	 * The template cannot: an untouched rail is open at one width and shut at another, and the markup
	 * is rendered before it has a width. So it ships one value and this corrects it once the sheet is
	 * in the document — otherwise a control that is now visible at every width announces "collapsed"
	 * beside a rail that is plainly showing.
	 *
	 * The two wordings come off the button, not from here: what this rail is called is the sheet's
	 * to say (moves on one, arches on the other) and a util that reached for `game.i18n` to find out
	 * would be answering a question it was never asked.
	 */
	syncToggle() {
		const toggle = this._toggle;
		if (!toggle) return;
		const open = this.isOpen;
		toggle.setAttribute("aria-expanded", String(open));
		const label = open ? toggle.dataset.labelHide : toggle.dataset.labelShow;
		if (!label) return;
		toggle.setAttribute("aria-label", label);
		toggle.setAttribute("title", label);
	}

	open() {
		this.setOpen(true);
		// The rail's own first control, not the rail itself: a tabindex="-1" container would take
		// the focus and then hand it straight back to the tab behind on the next Tab press.
		this._rail?.querySelector(FOCUSABLE)?.focus();
	}

	close() {
		this.setOpen(false);
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
 * Which rails one sheet's reader has put away, remembered across that sheet's re-renders.
 *
 * The rail keeps its state in the DOM, which is right until the DOM is replaced — and an
 * ApplicationV2 part is rebuilt wholesale on every render. Without this, editing a resident or
 * another player's change arriving over the socket brought back the column you had just closed.
 *
 * Owned by the sheet INSTANCE, like {@link OpenDisclosures}: whether you want the moves index in
 * front of you is a fact about you, not about the actor, and stored on the document it would open
 * and close on every screen at the table.
 *
 * What it remembers is what the READER CHANGED, so a rail they have never touched keeps following
 * the width — which is the whole point of the three-valued state.
 */
export class RailState {
	constructor() {
		this._state = new Map();
	}

	/** Record what a rail now is. Called after the toggle, so it reads the state that resulted. */
	remember(rail) {
		this._state.set(rail.key, rail.isOpen);
	}

	/** Put every rail in a freshly rendered tree back the way its reader left it. Idempotent. */
	restore(root) {
		for (const layout of root?.querySelectorAll?.(SheetRail.LAYOUT) ?? []) {
			const rail = new SheetRail(layout);
			if (this._state.has(rail.key)) rail.setOpen(this._state.get(rail.key));
			// Untouched, it still follows the width — but the toggle has to say which way that went.
			else rail.syncToggle();
		}
	}
}

/**
 * The rail toggle, as an ApplicationV2 actions entry. Pure view state — no actor write — so it is
 * not gated on editability and its button carries `data-view-state` to survive a locked sheet.
 *
 * `this` is the sheet, which is who remembers the state across the render this does not cause.
 */
export const RAIL_ACTIONS = {
	toggleRail(ev, target) {
		const rail = SheetRail.from(target);
		if (!rail) return;
		rail.toggle();
		this?.railState?.remember(rail);
	},
};
