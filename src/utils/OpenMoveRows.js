import { MoveDisclosure } from "./MoveDisclosure.js";

/**
 * Which move rows one sheet has open, remembered across that sheet's re-renders.
 *
 * A move disclosure keeps its state in the DOM, which is right until the DOM is replaced — and an
 * ApplicationV2 part is rebuilt wholesale on every render. So editing a resident, ticking a pip, or
 * another player at the table changing anything at all shut the move you were reading mid-sentence.
 *
 * Owned by the sheet INSTANCE, deliberately, and never written to the actor. Reading a move is not a
 * fact about the steading; it is a fact about the person reading it. Stored on the document, opening
 * Bolster would open it on every sheet at the table — and a second GM's edit would still be free to
 * close it again. Per-instance, your rows survive everyone else's writes and reach nobody else's
 * screen, which is the two halves of what was asked for.
 *
 * Keyed by the disclosure's region id, which the template mints per sheet, category and slug — so
 * this holds no notion of what a move is, and two sheets open on one actor cannot collide.
 */
export class OpenMoveRows {
	constructor() {
		this._open = new Set();
	}

	/** Record what a row now is. Called after the toggle, so it reads the state that resulted. */
	remember(disclosure) {
		if (disclosure.isOpen) this._open.add(disclosure.key);
		else this._open.delete(disclosure.key);
	}

	/**
	 * Put every row in a freshly rendered tree back the way its reader left it.
	 *
	 * Every row, not only the remembered ones: stated as "restore the state" rather than "re-open
	 * some", it is idempotent and cannot leave a row open that nobody opened.
	 */
	restore(root) {
		for (const toggle of root?.querySelectorAll?.(".stonetop-move-disclosure") ?? []) {
			MoveDisclosure.from(toggle)?.setOpen(this._open.has(toggle.getAttribute("aria-controls")));
		}
	}
}
