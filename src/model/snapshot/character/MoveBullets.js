import { rich } from "../RichText.js";
import { toRollableMarkup } from "../../../utils/enrichGameText.js";

/**
 * The list a move's own description spells out, as one RichText per bullet.
 *
 * Sibling to MoveGloss, and for the same reason: a move that states something the sheet wants to
 * render structurally has already stated it in its description, and a second authored copy is a
 * second thing to keep in step — and, worse, a second thing to TRANSLATE. The pack's step data
 * carries structure; the words are lifted from here, so a translator answers once.
 *
 * That is not idle tidiness. `system.steps[].text` is a translatable path, and the four Seasons
 * Change moves — which do author their step text — ship with every one of those strings blank in
 * German beside a fully translated description. The same sentence asked twice gets answered once.
 *
 * Inner HTML, not plain text (the difference from MoveGloss, which wants a one-line label): a
 * bullet can carry emphasis, and the caller renders it through {{rich}} like any other game text.
 *
 * Deterministic and pure — same text in, same list out.
 */
export class MoveBullets {
	/**
	 * @param {RichText|string|null} description  markdown as the packs ship it, or the HTML a move's
	 *   own sheet saves once its <prose-mirror> has been opened — both reach here, so both go through
	 *   the shared markup pass first (which returns HTML untouched).
	 * @returns {RichText[]} empty when the description spells nothing out, which is most moves.
	 */
	static from(description) {
		const raw = rich(description).raw.trim();
		if (!raw) return [];
		const html = toRollableMarkup(raw, { autoRoll: false });
		return [...html.matchAll(ITEM)]
			.map(match => rich(match[1].trim()))
			.filter(text => text.raw.length > 0);
	}
}

// Written as a complete open/close pair rather than a back-reference so an item can never close
// against the wrong partner and swallow the one after it. Non-greedy, and nested lists are not a
// shape any move in the book has.
const ITEM = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
