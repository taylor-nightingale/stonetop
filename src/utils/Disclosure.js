import { slideOpen, slideHeight, prefersReducedMotion } from "./motion.js";

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
	static SHUT_ONLY = "[data-disclosure-shut]";
	static OPEN_ONLY = "[data-disclosure-open]";
	/** On a toggle that only opens and shuts its region: a Moves panel's caret, sharing its bar with
	 *  the door whose row it is. It marks no row and switches none of the row's parts. */
	static REGION_ONLY = "data-disclosure-region-only";

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

	/**
	 * Read off the button: a region sliding shut is still on the page, and it is the button that
	 * already says what it is becoming. A toggle with no `aria-expanded` falls back to the region.
	 */
	get isOpen() {
		const expanded = this._toggle.getAttribute("aria-expanded");
		return expanded === null ? !this._body.hidden : expanded === "true";
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
		this._announce(open);
		for (const el of this._shutOnly) el.hidden = open;
		for (const el of this._openOnly) el.hidden = !open;
	}

	toggle() {
		this.setOpen(!this.isOpen);
	}

	/** Open or shut it over the sheet's slide; what the button says changes at once. */
	slide({ reduced = false } = {}) {
		const opening = !this.isOpen;
		this._announce(opening);
		slideOpen(this._body, opening, { reduced, stillOpen: () => this.isOpen });
		for (const el of this._shutOnly) slideOpen(el, !opening, { reduced, stillOpen: () => !this.isOpen });
		// A word or a line — a door's "Done", a bar's instruction — changes with the button, at once.
		for (const el of this._openOnly) el.hidden = !opening;
	}

	/**
	 * Trade one state for the other at once and ease the row's height between them — a section's
	 * door, whose bodies are the two states of one thing rather than a region under the rest. Sliding
	 * both at once put the two on screen together, and slid the door's own word out as content.
	 */
	swap({ reduced = false } = {}) {
		const row  = this._row;
		const from = row?.offsetHeight ?? 0;
		this.setOpen(!this.isOpen);
		if (row) slideHeight(row, from, row.offsetHeight, { reduced });
	}

	_announce(open) {
		const toggle = this._toggle;
		toggle.setAttribute("aria-expanded", String(open));
		this._row?.classList.toggle("is-open", open);
		const label = open ? toggle.dataset?.labelHide : toggle.dataset?.labelShow;
		if (!label) return;
		toggle.setAttribute("aria-label", label);
		toggle.setAttribute("title", label);
	}

	get _row() {
		if (this._toggle.hasAttribute?.(Disclosure.REGION_ONLY)) return null;
		return this._toggle.closest(Disclosure.ROW);
	}

	/**
	 * What the row shows only while it is shut — a move's gloss, which is its text in brief. The row's
	 * own, not a nested row's: a group's rows carry glosses of their own.
	 */
	get _shutOnly() {
		return this._ownParts(Disclosure.SHUT_ONLY);
	}

	/** What the row shows only while it is open — a section door's "Done", its bar's instruction. */
	get _openOnly() {
		return this._ownParts(Disclosure.OPEN_ONLY);
	}

	_ownParts(selector) {
		const row = this._row;
		if (!row) return [];
		return [...row.querySelectorAll(selector)].filter(el => el.closest(Disclosure.ROW) === row);
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

/** The same, sliding: a rail group, a move row's text. */
export function toggleSlidingDisclosure(ev, target) {
	const disclosure = Disclosure.from(target);
	if (!disclosure) return;
	disclosure.slide({ reduced: prefersReducedMotion(target.ownerDocument?.defaultView) });
	this.openDisclosures?.remember(disclosure);
}

/** The same, swapping: a section's door. */
export function toggleSwappingDisclosure(ev, target) {
	const disclosure = Disclosure.from(target);
	if (!disclosure) return;
	disclosure.swap({ reduced: prefersReducedMotion(target.ownerDocument?.defaultView) });
	this.openDisclosures?.remember(disclosure);
}
