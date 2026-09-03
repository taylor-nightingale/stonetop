import { Suggestion } from "../../snapshot/steading/SuggestionSnapshot.js";

/**
 * The book prints a region's names as one comma-separated line, and that is how they are stored — a
 * single free-text field per place that a GM edits. Reading down that line is how a villager gets
 * made, so each name has to become its own target.
 *
 * A token that is not plausibly a name is returned unclickable rather than dropped. The field is free
 * text: a GM who writes an instruction into it ("choose from the other lists") must still see what
 * they wrote, and must never get a button that would paste a sentence into a name cell.
 */
export class NamePool {
	/** @returns {Suggestion[]} */
	static parse(text, isUsed = () => false) {
		return String(text ?? "")
			.split(",")
			.map(token => token.trim())
			.filter(Boolean)
			.map(label => new Suggestion(label, isUsed(label), NamePool.looksLikeName(label)));
	}

	// Names in the book run to two words at most (a couple carry an apostrophe or a hyphen); prose
	// carries sentence punctuation. Either signal is enough to say "this is not a name".
	static looksLikeName(token) {
		return !/[.;:!?]/.test(token) && token.split(/\s+/).length <= 3;
	}
}
