/**
 * A search box that narrows a list in the DOM, and the query it currently holds.
 *
 * Generic on purpose and concrete nowhere: it knows how to hold a query, put it back in its box
 * after a render, and answer whether a row's text matches. WHICH box and WHICH rows is the owner's
 * business — `RosterFilter` searches the folk roster, `BoardView` searches the improvement board, and
 * each hard-codes its own selectors rather than being handed them by a caller.
 *
 * Deliberately without an `apply`: hiding a row is the owner's decision, because the owner may have
 * more to say about it. The board's chips and its search both narrow the same list, so a row is shown
 * only when BOTH allow it — two independent `apply`s would take turns overwriting each other's
 * `hidden`.
 *
 * Filtering in the DOM rather than by re-rendering: it writes nothing to the actor, and a document
 * update per keystroke would put every other client's sheet through a render to answer one person's
 * typing. Owned by the sheet INSTANCE and restored after each render, like OpenDisclosures — what you
 * are looking for is a fact about you, not about the steading.
 */
export class DomFilter {
	/**
	 * @param input  selector for the search box
	 * @param textOf what a row's searchable text is
	 */
	constructor(input, textOf) {
		this._input  = input;
		this._textOf = textOf;
		this._query  = "";
	}

	get query() { return this._query; }

	/** The selector its owner listens for, so the wiring names one thing rather than two. */
	get inputSelector() { return this._input; }

	/** @returns {boolean} whether the query changed, and the rows therefore need re-filtering. */
	setQuery(query) {
		const next = String(query ?? "").trim().toLowerCase();
		if (next === this._query) return false;
		this._query = next;
		return true;
	}

	/** Whether a row answers the current query. An empty query matches everything. */
	matches(row) {
		return !this._query || String(this._textOf(row) ?? "").toLowerCase().includes(this._query);
	}

	/** Put the query back in the box, which the template renders empty. */
	restoreInput(root) {
		const input = root?.querySelector?.(this._input);
		if (input && input.value !== this._query) input.value = this._query;
	}
}
