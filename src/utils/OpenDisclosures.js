import { Disclosure } from "./Disclosure.js";

/**
 * Which collapsible regions one sheet's reader has opened or shut, remembered across that sheet's
 * re-renders.
 *
 * A disclosure keeps its state in the DOM, which is right until the DOM is replaced — and an
 * ApplicationV2 part is rebuilt wholesale on every render. So editing a resident, ticking a pip, or
 * another player at the table changing anything at all shut the move you were reading mid-sentence.
 *
 * Owned by the sheet INSTANCE, deliberately, and never written to the actor. Reading a move, or
 * folding away a name list you are done with, is not a fact about the steading; it is a fact about
 * the person reading it. Stored on the document, opening Bolster would open it on every sheet at the
 * table — and a second GM's edit would still be free to close it again. Per-instance, your rows
 * survive everyone else's writes and reach nobody else's screen, which is the two halves of what was
 * asked for.
 *
 * What it remembers is what the READER CHANGED, not which regions are open — so the template still
 * decides where a region starts. A move row ships shut and a name list ships open, and neither is a
 * special case here.
 *
 * Keyed by the region id the toggle controls, which the template mints per sheet — so this holds no
 * notion of what a move or a name list is, and two sheets open on one actor cannot collide.
 */
export class OpenDisclosures {
	constructor() {
		this._state = new Map();
	}

	/** Record what a region now is. Called after the toggle, so it reads the state that resulted. */
	remember(disclosure) {
		this._state.set(disclosure.key, disclosure.isOpen);
	}

	/**
	 * Put every disclosure in a freshly rendered tree back the way its reader left it, and leave the
	 * ones they never touched exactly as the template rendered them.
	 *
	 * Idempotent, and it cannot open a region nobody opened.
	 */
	restore(root) {
		for (const toggle of root?.querySelectorAll?.(Disclosure.TOGGLE) ?? []) {
			const disclosure = Disclosure.from(toggle);
			if (disclosure && this._state.has(disclosure.key)) disclosure.setOpen(this._state.get(disclosure.key));
		}
	}
}
