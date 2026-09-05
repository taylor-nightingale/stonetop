import { RosterFocus } from "./RosterFocus.js";

/**
 * The roster's search box, and the rows it is currently hiding.
 *
 * It filters the ROSTER and nothing else. The name and trait lists beside it stay whole however
 * narrow the search gets, because reading down them is how an NPC gets made — so this class is given
 * the roster to work on and structurally cannot reach the reference column.
 *
 * Filtering is done in the DOM rather than by re-rendering: it writes nothing to the actor, and a
 * document update per keystroke would put every other client's sheet through a render to answer one
 * person's typing.
 *
 * Owned by the sheet instance and restored after each render, like OpenMoveRows — including the query
 * itself, which the template renders empty.
 */
export class RosterFilter {
	static INPUT = ".steading-folk-search";

	constructor() {
		this._query = "";
	}

	get query() {
		return this._query;
	}

	/** @returns {boolean} whether the query changed, and the rows therefore need re-filtering. */
	setQuery(query) {
		const next = String(query ?? "").trim().toLowerCase();
		if (next === this._query) return false;
		this._query = next;
		return true;
	}

	/** Whether a row's text answers the current query. Empty query matches everyone. */
	matches(text) {
		return !this._query || String(text ?? "").toLowerCase().includes(this._query);
	}

	/** Put the query back in the box and hide what it excludes. */
	restore(root) {
		const input = root?.querySelector?.(RosterFilter.INPUT);
		if (input && input.value !== this._query) input.value = this._query;
		this.apply(root);
	}

	apply(root) {
		for (const row of root?.querySelectorAll?.(RosterFocus.ROW) ?? []) {
			row.hidden = !this.matches(RosterFilter._rowText(row));
		}
	}

	// Every value written on the row — a search for "smith" should find the smith whether that word is
	// their occupation, their trait or their name. Traits is a textarea (its list wraps), so the
	// fields are asked for by what they are rather than by which tag they happen to use: an input-only
	// sweep silently stopped searching the widest column on the row.
	static _rowText(row) {
		return [...row.querySelectorAll("input[type='text'], textarea")].map(i => i.value).join(" ");
	}
}
