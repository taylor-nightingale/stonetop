/**
 * Which roster row the reader is working on, remembered across that sheet's re-renders.
 *
 * It exists so a click in the reference column has an obvious destination: a name replaces the
 * focused row's name, a trait appends to its traits. With nothing focused, a name click creates the
 * villager outright — which collapses browse-and-create into one gesture, and is how most of session
 * zero actually goes.
 *
 * The row is whichever one the reader last put the caret in, so nothing extra has to be clicked to
 * say "this one". Clicking a name in the reference column moves DOM focus out of the roster and the
 * remembered row stays — which is exactly right, because that click is about that row.
 *
 * Owned by the sheet INSTANCE and never written to the actor, for the same reason OpenMoveRows is:
 * which row you are editing is a fact about you, not about the steading. Stored on the document it
 * would move everyone's caret at the table.
 */
export class RosterFocus {
	static ROW = ".steading-folk-row";
	static ROSTER = ".steading-folk-roster";

	constructor() {
		this._id = null;
	}

	get id() {
		return this._id;
	}

	/** Follow the caret: focus landing anywhere inside a row makes that row the one being worked on. */
	noteFocus(target) {
		const row = target?.closest?.(RosterFocus.ROW);
		if (row) this._id = row.dataset.id;
	}

	/** Focus a row by id — how the sheet points the caret at someone it has just created. */
	focusOn(id) {
		this._id = id;
	}

	clear() {
		this._id = null;
	}

	/**
	 * Mark the focused row in a freshly rendered tree.
	 *
	 * Every row, not only the remembered one — stated as "restore the state" it is idempotent, and a
	 * row whose person has since been deleted simply finds no match and nothing is marked.
	 */
	restore(root) {
		let found = false;
		for (const row of root?.querySelectorAll?.(RosterFocus.ROW) ?? []) {
			const isFocused = row.dataset.id === this._id;
			row.classList.toggle("is-focused", isFocused);
			if (isFocused) { row.setAttribute("aria-current", "true"); found = true; }
			else row.removeAttribute("aria-current");
		}
		// The reference column reads this to say whether a trait click has anywhere to land.
		for (const panel of root?.querySelectorAll?.(".steading-folk-ref") ?? []) {
			panel.toggleAttribute("data-folk-focused", found);
		}
	}
}
