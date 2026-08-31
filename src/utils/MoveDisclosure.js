/**
 * One move row, collapsed or open.
 *
 * The row's name is a button; activating it shows the move's text in flow beneath. Independent, not
 * an accordion — opening one never closes another. The DOM is the state: the button says what it is
 * through `aria-expanded` and the region says it through `hidden`, so a screen reader and a
 * stylesheet read the same two facts and there is no third copy to drift.
 *
 * That leaves the row with nothing to say once its DOM is replaced, which is what a re-render does —
 * see OpenMoveRows for who remembers across one.
 */
export class MoveDisclosure {
	/** The disclosure a toggle button drives, or null when the button controls nothing. */
	static from(toggle) {
		const body = toggle?.getAttribute?.("aria-controls")
			&& toggle.ownerDocument?.getElementById(toggle.getAttribute("aria-controls"));
		return body ? new MoveDisclosure(toggle, body) : null;
	}

	constructor(toggle, body) {
		this._toggle = toggle;
		this._body   = body;
	}

	get isOpen() {
		return !this._body.hidden;
	}

	/**
	 * What identifies this row to anything outside its own DOM — the id of the region the button
	 * controls, which the template already mints per sheet, category and move slug. So the same move
	 * listed under two categories is two rows, and two sheets open on one actor never collide.
	 */
	get key() {
		return this._body.id;
	}

	setOpen(open) {
		this._body.hidden = !open;
		this._toggle.setAttribute("aria-expanded", String(open));
		// The row itself is marked so the caret can turn and the shut row can hide its gloss without
		// either needing to know about the other.
		this._toggle.closest(".stonetop-item, .stonetop-move-item")?.classList.toggle("is-open", open);
	}

	toggle() {
		this.setOpen(!this.isOpen);
	}
}

/**
 * The toggle, as an ApplicationV2 actions entry. Pure view state — no actor write — so it is not
 * gated on editability, and its button carries `data-view-state` to survive a locked sheet.
 *
 * The sheet is told what the row now is, so the next render can put it back. A sheet that keeps no
 * such record still works; the row simply shuts on the next render, as it did before.
 */
export const MOVE_DISCLOSURE_ACTIONS = {
	toggleMoveBody(ev, target) {
		const disclosure = MoveDisclosure.from(target);
		if (!disclosure) return;
		disclosure.toggle();
		this.openMoveRows?.remember(disclosure);
	},
};
