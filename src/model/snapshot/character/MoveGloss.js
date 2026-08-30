import { rich } from "../RichText.js";

/**
 * A move's trigger, in a few words — what a collapsed disclosure row says about itself.
 *
 * Every move in the book opens by naming its trigger in emphasis: *When you **_send a steading's
 * people into danger_**, roll +Defenses…*. That emphasised run IS the gloss — "send a steading's
 * people into danger" — so nothing is invented, summarised or authored here. It is lifted from the
 * move's own text, which is also why it stays right when the packs are rebuilt or translated.
 *
 * The FIRST run, specifically: the result tiers are emphasised too (**on a 10+**), and a move with
 * two triggers (Convalesce, Trade & Barter) is glossed by the one it leads with.
 *
 * Deterministic and pure — same text in, same string out — so it is a table of cases in a test
 * rather than something you have to open a sheet to check.
 */
export class MoveGloss {
	/** The gloss for a move description (a RichText or a raw markdown string); "" when there is none. */
	static from(description) {
		const raw = rich(description).raw.trim();
		if (!raw) return "";
		return plain(firstEmphasis(raw) ?? firstSentence(raw));
	}
}

// Emphasis runs, in the nestings the packs use. Written as complete open/close PAIRS rather than a
// back-reference: `**_x_**` opens with `**_` and closes with `_**`, so a back-reference never finds
// its partner and runs on into the next trigger. Alternation takes the leftmost match, and the
// nested forms are listed first so `**_x_**` yields `x` rather than `_x_`.
const EMPHASIS = /\*\*_([\s\S]+?)_\*\*|__\*([\s\S]+?)\*__|\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|\*([\s\S]+?)\*|_([\s\S]+?)_/g;

// A move's result tiers are emphasised exactly as its trigger is, so a move that emphasises only its
// tiers would otherwise be glossed "on a 10+" — which labels the row with the wrong half of the move.
const TIER = /^on a \d+\s*[-+]/i;

function firstEmphasis(raw) {
	for (const match of raw.matchAll(EMPHASIS)) {
		const text = match.slice(1).find(g => g !== undefined)?.trim();
		if (text && !TIER.test(plain(text))) return text;
	}
	return null;
}

// A move with no emphasis at all (a custom one somebody typed) still gets a row that says something.
// Its first sentence, capped — a gloss is a label, and a label that wraps is not one.
const MAX = 90;

function firstSentence(raw) {
	const sentence = raw.split(/(?<=[.!?])\s|\n/)[0].trim();
	return sentence.length > MAX ? `${sentence.slice(0, MAX - 1).trimEnd()}…` : sentence;
}

// Whatever markup survived inside the run — the packs nest emphasis, and a gloss is plain text in a
// single line, not a second place rich text gets rendered.
function plain(text) {
	return text.replace(/[*_`]/g, "").replace(/\s+/g, " ").trim();
}
