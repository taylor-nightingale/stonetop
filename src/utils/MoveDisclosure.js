/**
 * One move row, collapsed or open.
 *
 * The row's name is a button; activating it shows the move's text in flow beneath. Independent, not
 * an accordion — opening one never closes another. There is no state to store: the button says what
 * it is through `aria-expanded` and the region says it through `hidden`, so a screen reader and a
 * stylesheet read the same two facts and there is no third copy to drift.
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

	toggle() {
		const open = !this.isOpen;
		this._body.hidden = !open;
		this._toggle.setAttribute("aria-expanded", String(open));
		// The row itself is marked so the caret can turn and the shut row can hide its gloss without
		// either needing to know about the other.
		this._toggle.closest(".stonetop-item, .stonetop-move-item")?.classList.toggle("is-open", open);
	}
}

/**
 * The toggle, as an ApplicationV2 actions entry. Pure view state — no actor write — so it is not
 * gated on editability, and its button carries `data-view-state` to survive a locked sheet.
 */
export const MOVE_DISCLOSURE_ACTIONS = {
	toggleMoveBody(ev, target) {
		MoveDisclosure.from(target)?.toggle();
	},
};
