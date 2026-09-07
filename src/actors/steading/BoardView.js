import { DomFilter } from "../../utils/DomFilter.js";

/**
 * How this reader is looking at the improvement board: what they have searched for, and which states
 * they have narrowed it to.
 *
 * On the sheet INSTANCE and never on the actor, for the same reason the roster's search and caret
 * are: which projects you are looking at is a fact about you, not about the steading. Stored on the
 * document, one person filtering to "in progress" would narrow the board for everyone at the table.
 *
 * Filtering is done in the DOM rather than by re-rendering — it writes nothing, so it costs no
 * document update and no render on anyone else's client.
 *
 * The chips and the search narrow the SAME list, so they are one class and one pass: a row is shown
 * only when both allow it. Two objects each setting `row.hidden` would take turns overwriting the
 * other's answer, and which one won would come down to the order the sheet happened to restore them
 * in. Twenty-plus rows is what made the search necessary — three chips are not a way to find "mill".
 *
 * The board is NOT ordered by progress, and there is no sort control. Ticking a requirement changed
 * how far along a card was, which changed where it sat — so the thing you were clicking moved out
 * from under you. The board keeps the order the steading owns its improvements in, which nothing the
 * reader does disturbs.
 */

/** The three states a project can be in, as the chips name them. Each row is exactly one. */
export const BOARD_STATES = ["progress", "untouched", "complete"];

/**
 * What a row is ABOUT right now, which cuts across its state: a card that is owed something is also a
 * complete one, and a card firing this season can be in any state at all.
 *
 * A second axis rather than three more states, because they are not alternatives to each other and a
 * reader asking "what is owed?" is not thereby saying anything about progress. The axes AND together:
 * "complete AND owed" is a question, and so is "in progress AND fires this season".
 */
export const BOARD_FLAGS = ["owed", "season"];

export class BoardView {
	static ROW      = ".steading-improvement-card";
	static CHIP     = "[data-board-filter]";
	static FLAG     = "[data-board-flag]";
	static INPUT    = ".steading-board-search";

	constructor() {
		this._states = new Set();
		this._flags  = new Set();
		this._search = new DomFilter(BoardView.INPUT, BoardView._rowText);
	}

	get query() { return this._search.query; }

	/** @returns {boolean} whether the query changed, and the rows therefore need re-filtering. */
	setQuery(query) { return this._search.setQuery(query); }

	/** No chip pressed means no filter — the whole board, which is where a reader starts. */
	get isFiltered() { return this._states.size > 0; }

	isOn(state) { return this._states.has(state); }

	isFlagOn(flag) { return this._flags.has(flag); }

	/**
	 * Toggle one of the cross-cutting chips. Same shape as `toggle`, and the same reason for it:
	 * pressing the last active one clears back to the whole board.
	 *
	 * @returns {boolean} whether anything changed, and the rows therefore need re-filtering.
	 */
	toggleFlag(flag) {
		if (!BOARD_FLAGS.includes(flag)) return false;
		if (this._flags.has(flag)) this._flags.delete(flag);
		else this._flags.add(flag);
		return true;
	}

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

	/** Whether a row in the given state is currently shown by the STATE chips. */
	shows(state) {
		return !this.isFiltered || this._states.has(state);
	}

	/**
	 * Whether a row carrying these flags survives the flag chips.
	 *
	 * OR within the axis, as the states are: "owed or firing now" is one question. No flag pressed is
	 * the whole board, so "nothing selected" never means "nothing shown".
	 */
	showsFlags(flags = []) {
		return this._flags.size === 0 || flags.some(flag => this._flags.has(flag));
	}

	/** Put the chips and the search box back the way this reader left them, and hide what they exclude. */
	restore(root) {
		for (const chip of root?.querySelectorAll?.(BoardView.CHIP) ?? []) {
			chip.setAttribute("aria-pressed", String(this.isOn(chip.dataset.boardFilter)));
		}
		for (const chip of root?.querySelectorAll?.(BoardView.FLAG) ?? []) {
			chip.setAttribute("aria-pressed", String(this.isFlagOn(chip.dataset.boardFlag)));
		}
		this._search.restoreInput(root);
		this.apply(root);
	}

	apply(root) {
		for (const row of root?.querySelectorAll?.(BoardView.ROW) ?? []) {
			row.hidden = !(this.shows(row.dataset.state)
				&& this.showsFlags(BoardView._flagsOn(row))
				&& this._search.matches(row));
		}
	}

	/** What a row says it is about — written on the row, so this holds no notion of what "owed" is. */
	static _flagsOn(row) {
		return BOARD_FLAGS.filter(flag => row.dataset[`board${flag[0].toUpperCase()}${flag.slice(1)}`] === "true");
	}

	// The whole card: its name, its requirement rows and its payoff. Someone hunting for "mill" types
	// the name, but someone asking "what gives me Surplus?" types that instead — and the answer is in
	// the payoff, which is in the DOM whether the card is open or shut.
	static _rowText(row) {
		return row.textContent;
	}
}
