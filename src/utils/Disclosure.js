/**
 * One collapsible region, open or shut — a move row's text, a name list in the steading's reference
 * column, anything else a button opens in flow beneath itself.
 *
 * The DOM is the state: the button says what it is through `aria-expanded` and the region says it
 * through `hidden`, so a screen reader and a stylesheet read the same two facts and there is no third
 * copy to drift. Independent, never an accordion — opening one never closes another.
 *
 * An enclosing element marked `data-disclosure-row` also carries `is-open` — the row a caret turns
 * in, the block a shut list hides its gloss from. The MARKUP says which element that is rather than
 * this class naming a selector: the row is the caller's own wrapper, and a disclosure that draws
 * nothing outside its button and body simply marks nothing.
 *
 * That leaves the region with nothing to say once its DOM is replaced, which is what a re-render
 * does — see OpenDisclosures for who remembers across one.
 */
export class Disclosure {
	/** Every disclosure toggle carries this, and it is what OpenDisclosures finds them by. */
	static TOGGLE = "[data-disclosure]";
	static ROW    = "[data-disclosure-row]";

	/** The disclosure a toggle button drives, or null when the button controls nothing. */
	static from(toggle) {
		const body = toggle?.getAttribute?.("aria-controls")
			&& toggle.ownerDocument?.getElementById(toggle.getAttribute("aria-controls"));
		return body ? new Disclosure(toggle, body) : null;
	}

	constructor(toggle, body) {
		this._toggle = toggle;
		this._body   = body;
	}

	get isOpen() {
		return !this._body.hidden;
	}

	/**
	 * What identifies this region to anything outside its own DOM — the id of the region the button
	 * controls, which the template already mints per sheet and per thing. So the same move listed
	 * under two categories is two rows, and two sheets open on one actor never collide.
	 */
	get key() {
		return this._body.id;
	}

	setOpen(open) {
		this._body.hidden = !open;
		this._toggle.setAttribute("aria-expanded", String(open));
		this._toggle.closest(Disclosure.ROW)?.classList.toggle("is-open", open);
	}

	toggle() {
		this.setOpen(!this.isOpen);
	}
}

/**
 * The sheet action every disclosure toggle uses: flip the region, and tell the sheet what it now is
 * so the next render can put it back. One implementation because there is one behaviour — a move
 * row, a folded name list and an improvement card differ in what they contain, not in how they open.
 *
 * Not edit-gated: opening something to read it is reading, and a locked sheet is exactly when a
 * player wants to.
 */
export function toggleDisclosure(ev, target) {
	const disclosure = Disclosure.from(target);
	if (!disclosure) return;
	disclosure.toggle();
	this.openDisclosures?.remember(disclosure);
}
