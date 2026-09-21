/**
 * The character sheet's top band, and the folded line it swaps places with.
 *
 * One component, two densities — the steading's own device, applied to the band: expanded it is six
 * stat tiles, three debility bands, HP/Armor/Damage and the portrait; folded it is one ledger line.
 * Both are in the markup at every width and the stylesheet picks between them, so this writes one
 * class and nothing else. Nothing measures anything, and nothing is ever unreachable.
 *
 * Two-valued, unlike {@link SheetRail}: a rail is open, shut, or however the width has it, because a
 * narrow sheet turns it into a drawer on its own. A band has no such width — it is folded or it is
 * not, and the reader is the only one who says which.
 *
 * Deliberately NOT a SheetRail: the two share a shape and nothing else. The rail's third state, its
 * drawer, its focus manners and its `data-side` are all answers to questions a band does not ask.
 */
export class TopBand {
	static WRAPPER   = ".sheet-wrapper";
	static BAND      = ".sheet-top";
	static TOGGLE    = ".stonetop-top-toggle";
	static COLLAPSED = "top-collapsed";

	/** The band owning `target`, or null when the control is not inside one. */
	static from(target) {
		const wrapper = target?.closest?.(TopBand.WRAPPER);
		return wrapper?.querySelector?.(TopBand.BAND) ? new TopBand(wrapper) : null;
	}

	constructor(wrapper) {
		this._wrapper = wrapper;
	}

	/**
	 * What identifies this band to anything outside its own DOM — the id of the region the toggle
	 * controls, which the template mints per sheet. Same key idea as the rail's and a disclosure's.
	 */
	get key() {
		return this._band?.id ?? "";
	}

	get isCollapsed() {
		return this._wrapper.classList.contains(TopBand.COLLAPSED);
	}

	get _band() {
		return this._wrapper.querySelector(TopBand.BAND);
	}

	get _toggle() {
		return this._wrapper.querySelector(TopBand.TOGGLE);
	}

	/**
	 * Say what the band now is, and nothing else. This is the restore path: putting a freshly
	 * rendered band back the way its reader left it must not move anybody's focus.
	 */
	setCollapsed(collapsed) {
		this._wrapper.classList.toggle(TopBand.COLLAPSED, collapsed);
		this.syncToggle();
	}

	/**
	 * Make the toggle say what the band actually is — the state it announces, and what pressing it
	 * will do. The two wordings come off the button, not from here: what this band is called is the
	 * sheet's to say, and a util reaching for `game.i18n` would be answering a question it was never
	 * asked.
	 */
	syncToggle() {
		const toggle = this._toggle;
		if (!toggle) return;
		const shown = !this.isCollapsed;
		toggle.setAttribute("aria-expanded", String(shown));
		const label = shown ? toggle.dataset.labelHide : toggle.dataset.labelShow;
		if (!label) return;
		toggle.setAttribute("aria-label", label);
		toggle.setAttribute("title", label);
	}

	/**
	 * Fold or unfold. No focus move either way, unlike the rail's: nothing is overlaid and nothing
	 * goes off screen — the numbers swap densities in place, and the control stays exactly where the
	 * reader's pointer already is.
	 */
	toggle() {
		this.setCollapsed(!this.isCollapsed);
	}
}

/**
 * Which bands this sheet's reader has folded, remembered across that sheet's re-renders.
 *
 * The band keeps its state in the DOM, which is right until the DOM is replaced — and an
 * ApplicationV2 part is rebuilt wholesale on every render. Without this, ticking a pip or another
 * player's edit arriving over the socket unfolded the band you had just put away, and the toggle
 * went back to announcing the state the template ships rather than the one on screen.
 *
 * Owned by the sheet INSTANCE, like {@link RailState}: whether you want the numbers at full size is
 * a fact about you, not about the actor, and stored on the document it would fold and unfold on
 * every screen at the table.
 */
export class TopBandState {
	constructor() {
		this._state = new Map();
	}

	/** Record what a band now is. Called after the toggle, so it reads the state that resulted. */
	remember(band) {
		this._state.set(band.key, band.isCollapsed);
	}

	/** Put every band in a freshly rendered tree back the way its reader left it. Idempotent. */
	restore(root) {
		for (const wrapper of wrappersIn(root)) {
			const band = new TopBand(wrapper);
			if (!band.key) continue;
			if (this._state.has(band.key)) band.setCollapsed(this._state.get(band.key));
			// Untouched, the template's own state stands — but the toggle still has to announce it.
			else band.syncToggle();
		}
	}
}

/**
 * The wrappers in a tree, INCLUDING the tree's own root.
 *
 * `querySelectorAll` searches descendants only, and the two callers hand in different things: on a
 * re-render core passes `_syncPartState` the new PART element, which is the `.sheet-wrapper` itself,
 * and on first render the sheet passes its application root, which merely contains one. Searching
 * descendants alone silently restored nothing on exactly the path the state exists for — the band
 * sprang back open on every re-render, which is the bug it was written to fix.
 *
 * The rail does not hit this because `.stonetop-rail-layout` is a descendant of the wrapper either
 * way. The fold's class lives ON the wrapper, so it does.
 */
function wrappersIn(root) {
	if (!root?.querySelectorAll) return [];
	const found = [...root.querySelectorAll(TopBand.WRAPPER)];
	if (root.matches?.(TopBand.WRAPPER)) found.unshift(root);
	return found;
}

/**
 * The fold toggle, as an ApplicationV2 actions entry. Pure view state — no actor write — so it is
 * not gated on editability and its button carries `data-view-state` to survive a locked sheet:
 * reading your own stats mutates nothing.
 *
 * `this` is the sheet, which is who remembers the state across the render this does not cause.
 */
export const TOP_BAND_ACTIONS = {
	toggleTop(ev, target) {
		const band = TopBand.from(target);
		if (!band) return;
		band.toggle();
		this?.topBandState?.remember(band);
	},
};
