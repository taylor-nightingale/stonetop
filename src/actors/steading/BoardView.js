/**
 * How this reader is looking at the improvement board: which states they have narrowed it to.
 *
 * On the sheet INSTANCE and never on the actor, for the same reason the roster's search and caret
 * are: which projects you are looking at is a fact about you, not about the steading. Stored on the
 * document, one person filtering to "in progress" would narrow the board for everyone at the table.
 *
 * Filtering is done in the DOM rather than by re-rendering — it writes nothing, so it costs no
 * document update and no render on anyone else's client.
 *
 * The board is NOT ordered by progress, and there is no sort control. Ticking a requirement changed
 * how far along a card was, which changed where it sat — so the thing you were clicking moved out
 * from under you. The board keeps the order the steading owns its improvements in, which nothing the
 * reader does disturbs.
 */

/** The three states a project can be in, as the chips name them. */
export const BOARD_STATES = ["progress", "untouched", "complete"];

export class BoardView {
	static ROW      = ".steading-improvement-card";
	static CHIP     = "[data-board-filter]";

	constructor() {
		this._states = new Set();
	}

	/** No chip pressed means no filter — the whole board, which is where a reader starts. */
	get isFiltered() { return this._states.size > 0; }

	isOn(state) { return this._states.has(state); }

	/**
	 * Toggle one chip. Independent toggles rather than one-at-a-time, because "in progress AND
	 * nearly done" is a real question; pressing the last active one clears back to the whole board.
	 *
	 * @returns {boolean} whether anything changed, and the rows therefore need re-filtering.
	 */
	toggle(state) {
		if (!BOARD_STATES.includes(state)) return false;
		if (this._states.has(state)) this._states.delete(state);
		else this._states.add(state);
		return true;
	}

	/** Whether a row in the given state is currently shown. */
	shows(state) {
		return !this.isFiltered || this._states.has(state);
	}

	/** Put the chips back the way this reader left them, and hide what they exclude. */
	restore(root) {
		for (const chip of root?.querySelectorAll?.(BoardView.CHIP) ?? []) {
			chip.setAttribute("aria-pressed", String(this.isOn(chip.dataset.boardFilter)));
		}
		this.apply(root);
	}

	apply(root) {
		for (const row of root?.querySelectorAll?.(BoardView.ROW) ?? []) {
			row.hidden = !this.shows(row.dataset.state);
		}
	}
}
