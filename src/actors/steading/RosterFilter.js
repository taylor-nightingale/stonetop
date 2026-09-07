import { RosterFocus } from "./RosterFocus.js";
import { DomFilter } from "../../utils/DomFilter.js";

/**
 * The roster's search box, and the rows it is currently hiding.
 *
 * It filters the ROSTER and nothing else. The name and trait lists beside it stay whole however
 * narrow the search gets, because reading down them is how an NPC gets made — so this class names the
 * roster's own rows and structurally cannot reach the reference column.
 *
 * Composes DomFilter rather than being a configurable one: which box and which rows is exactly the
 * knowledge this class exists to hold. See DomFilter for why the filtering happens in the DOM.
 */
export class RosterFilter {
	static INPUT = ".steading-folk-search";

	constructor() {
		this._filter = new DomFilter(RosterFilter.INPUT, RosterFilter._rowText);
	}

	get query() { return this._filter.query; }

	/** @returns {boolean} whether the query changed, and the rows therefore need re-filtering. */
	setQuery(query) { return this._filter.setQuery(query); }

	/** Put the query back in the box and hide what it excludes. */
	restore(root) {
		this._filter.restoreInput(root);
		this.apply(root);
	}

	apply(root) {
		for (const row of root?.querySelectorAll?.(RosterFocus.ROW) ?? []) {
			row.hidden = !this._filter.matches(row);
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
