/**
 * Free text on a roster row, as something the reference lists can be compared against.
 *
 * The Folk tab's name and trait pools dim an entry the steading already uses, which means asking
 * whether a pool entry is written on somebody's row. What is written there is whatever the table
 * typed: `Cheery.` and `- cheery` and `eagle eye` against the pool's `eagle-eye` all mean the trait,
 * and none of them is string-equal to it.
 *
 * So there is no tokenising anywhere in this system. Traits were never reliably comma-separated —
 * the cell is a textarea and tables write them with spaces, semicolons, newlines and whatever else —
 * and a separator no list can be cut on is a separator not worth guessing at. `normalize` flattens
 * every run of punctuation and whitespace to one space, at which point the separators simply are not
 * there any more, and `mentions` asks the only question left: does this row say that.
 */
export class RosterText {
	/**
	 * The same text with case and every separator and flourish flattened away.
	 *
	 * Apostrophes go before the flattening rather than through it: an apostrophe sits INSIDE a word,
	 * so `doesn't` has to come out as one word for a row that wrote `doesnt` to match the pool. A
	 * hyphen sits BETWEEN words, so it becomes the space that lets `eagle-eye` match `eagle eye`.
	 */
	static normalize(value) {
		return String(value ?? "").toLowerCase().replace(/['\u2019]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
	}

	/**
	 * Whether `needle` is written somewhere in `haystack` as a whole phrase.
	 *
	 * Padded with spaces on both sides, so `blind` is found in `blind drunk` and not in `commute`.
	 * Whole-PHRASE, not whole-field: with no separator to trust, a cell reads as a sentence, and a
	 * trait inside one is a trait this steading uses. It follows that `immaculate` would be found in
	 * `immaculate appearance` — an overlap that cannot be had one way without the other, and the
	 * dimming is advisory, so the wider read is the useful one.
	 */
	static mentions(haystack, needle) {
		const phrase = RosterText.normalize(needle);
		if (!phrase) return false;
		return ` ${RosterText.normalize(haystack)} `.includes(` ${phrase} `);
	}

	/** Whether two pieces of text say the same thing — a whole cell holding one value, like a name. */
	static same(a, b) {
		const left = RosterText.normalize(a);
		return !!left && left === RosterText.normalize(b);
	}
}
