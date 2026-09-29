import { rich } from "../RichText.js";
import { toRollableMarkup } from "../../../utils/enrichGameText.js";
import { plainText } from "../../../utils/plainText.js";

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
 * A description is stored as markdown (as the packs ship it) or as HTML (once the move's own sheet
 * has been opened and its <prose-mirror> has saved), so both have to be read. Rather than two sets
 * of patterns to keep in step, the text goes through the shared markup pass first — which converts
 * markdown and returns HTML untouched — and the run is lifted from the HTML that comes out.
 *
 * Deterministic and pure — same text in, same string out — so it is a table of cases in a test
 * rather than something you have to open a sheet to check.
 */
export class MoveGloss {
	/** The gloss for a move description (a RichText, markdown, or HTML); "" when there is none. */
	static from(description) {
		const raw = rich(description).raw.trim();
		if (!raw) return "";
		const html = toRollableMarkup(raw, { autoRoll: false });
		return firstEmphasis(html) ?? firstSentence(html);
	}
}

// An emphasised run, in the nestings the markup can arrive in. Written as complete open/close PAIRS
// rather than a back-reference so a run can never close against the wrong partner and swallow the
// next trigger. The DOUBLED forms are listed first: alternation takes the leftmost match and, among
// alternatives starting at the same place, the first that matches — so `<strong><em>x</em></strong>`
// yields "x" rather than "<em>x</em>". The single forms come last, for a custom move whose author
// emphasised the trigger once.
const EMPHASIS = new RegExp([
	"<strong>\\s*<em>([\\s\\S]*?)</em>\\s*</strong>",
	"<em>\\s*<strong>([\\s\\S]*?)</strong>\\s*</em>",
	"<strong>([\\s\\S]*?)</strong>",
	"<em>([\\s\\S]*?)</em>",
].join("|"), "gi");

// A move's result tiers are emphasised exactly as its trigger is, so a move that emphasises only its
// tiers would otherwise be glossed "on a 10+" — which labels the row with the wrong half of the move.
// The en dash too: the post-death moves write "on a 7–9" and "on a 6–".
const TIER = /^on a \d+\s*[-+–]/i;

function firstEmphasis(html) {
	for (const match of html.matchAll(EMPHASIS)) {
		const text = plainText(match.slice(1).find(group => group !== undefined) ?? "");
		if (text && !TIER.test(text)) return text;
	}
	return null;
}

// A move with no emphasis at all (a custom one somebody typed) still gets a row that says something.
// Its first sentence, capped — a gloss is a label, and a label that wraps is not one.
const MAX = 90;

function firstSentence(html) {
	const sentence = plainText(firstBlock(html)).split(/(?<=[.!?])\s/)[0].trim();
	return sentence.length > MAX ? `${sentence.slice(0, MAX - 1).trimEnd()}…` : sentence;
}

// A block ends a statement as surely as a full stop does: "Pick one" followed by a list of options is
// one statement, and running it into items that carry no full stops made the gloss the whole move.
// Either shape reaches here — a wrapped block from the editor, or the <br>/<ul> the markdown pass
// emits for a bare paragraph.
function firstBlock(html) {
	// Anchored at the start, so a document that opens with a wrapped block yields that block. Left
	// unanchored it found the first block ANYWHERE — for "Pick one" followed by a list, that was the
	// list's first <li>, and the gloss became "a thing".
	const wrapped = /^\s*<(p|li|h[1-6]|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/i.exec(html);
	if (wrapped) return wrapped[2];
	// Otherwise the text opens bare — the shape the markdown pass emits for a leading paragraph —
	// so the first block boundary after it is where the statement ends.
	return html.split(/<br\s*\/?>|<(?:ul|ol|p|h[1-6]|blockquote|table)\b[^>]*>/i)[0];
}
