// The one rule for the book's line-break hyphens, shared by every parser that joins wrapped lines.
//
// Setting the books justified, the typesetter breaks a long word across lines with a hyphen
// ("advan-" / "tage"), and joining those lines has to drop it. But a hyphen at a line end is
// sometimes the word's OWN hyphen ("star-" / "filled"), and dropping that one fuses a compound the
// book spells with a hyphen. Nothing in the glyph geometry tells the two apart — the decision is
// lexical, so it lives here rather than being re-guessed by each caller.

/** A word the book spells with a hyphen, listed here because it also happens to break at that hyphen
 *  somewhere in the text. Keyed by the whole word as the break spells it, lowercase. Attested
 *  elsewhere in the corpus: "bug-like" is set mid-line in the Three Coven Lake tables; the rest are
 *  editorial judgement — "toad-like" against the book's own "toadlike statue", which it also prints.
 *
 *  Only a word listed here keeps its hyphen. A continuation that is itself hyphenated is no evidence
 *  either way: the lithic servant's "stone-" + "on-stone" is a compound, but the luglfsk's "ma-" +
 *  "ny-legged" is "many-legged" — an ordinary word break that happens to land before a compound. */
export const KEEP_HYPHEN = new Set([
	"birch-white", "bug-like", "cast-out", "ever-greedy", "gold-embroidered", "grave-dirt",
	"punched-out", "rage-filled", "star-filled", "stone-on-stone", "toad-like", "world-motes",
]);

// The word ending the line, and the word starting the next — the next one taken with any hyphens of
// its own, so "on-stone" is read whole rather than as a bare "on".
const TAIL = /([A-Za-z]+)-$/;
const HEAD = /^([a-z][A-Za-z]*(?:-[A-Za-z]+)*)/;
// A suspended hyphen: "long- and cruelly-bound", "smoke- or dust-filled". The conjunction alone is no
// signal — "col-" + "or" is one word — so this asks for the hyphenated word the suspension points at.
const SUSPENDED = /^(?:and|or|nor)\s+\S*[A-Za-z]-[A-Za-z]/;

/**
 * What the hyphen ending a line turned out to be. `heal` drops it (the two lines are one word);
 * `tight` says the lines close up with no space between them, which a kept hyphen also wants —
 * only a suspended hyphen ("long- and cruelly-bound") keeps the space the book prints after it.
 * `reason` is what a build report shows for review.
 */
export class WrapDecision {
	constructor({ heal, tight, reason, left = "", right = "" }) {
		this.heal = heal;
		this.tight = tight;
		this.reason = reason;
		this.left = left;
		this.right = right;
	}
	/** The hyphenated pair as the book broke it, for a report line or a KEEP_HYPHEN lookup. */
	get pair() { return `${this.left}-${this.right}`; }
	/** True when the call was a judgement rather than the ordinary word break — what a report lists. */
	get notable() { return this.reason !== "word-break" && this.reason !== "no-hyphen"; }
}

const NO_HYPHEN = new WrapDecision({ heal: false, tight: false, reason: "no-hyphen" });

/**
 * Decide what the hyphen ending `prev` means, given the line `next` that continues it. Both are the
 * raw line texts, trimmed — emphasis markup and pick-box markers must already be gone.
 */
export function explainWrap(prev, next) {
	const tail = TAIL.exec(prev ?? "");
	const head = HEAD.exec(next ?? "");
	if (!tail || !head) return NO_HYPHEN;
	const [left, right] = [tail[1], head[1]];
	const decide = (heal, tight, reason) => new WrapDecision({ heal, tight, reason, left, right });
	if (SUSPENDED.test(next)) return decide(false, false, "suspended");
	if (KEEP_HYPHEN.has(`${left}-${right}`.toLowerCase())) return decide(false, true, "known-compound");
	return decide(true, true, "word-break");
}

// What an emphasis run may close with between the hyphen and the end of the buffer, for `healWrap` —
// the book breaks words inside bold/italic runs, so the hyphen ends up just inside the closer.
export const HTML_CLOSERS = /-((?:<\/(?:strong|em)>)*)$/;
export const MD_CLOSERS = /-([*_]*)$/;

/**
 * Drop the wrap hyphen from the end of an accumulated string. `closers` says what may sit between the
 * hyphen and the end of the buffer — the closing tags or markdown markers of an emphasis run the
 * hyphen fell inside ("<strong>Dan-</strong>" + "gers"). It must capture them as group 1, which is
 * put back in the hyphen's place; the default captures nothing, for a buffer of plain text.
 */
export const healWrap = (acc, closers = /-()$/) => acc.replace(closers, "$1");

/**
 * Append a continuation line to an accumulated string under the line-break hyphen rule — the whole
 * job, for callers whose buffer is a plain string.
 *
 * A buffer carrying markup passes the plain lines it was built from as `prevRaw`/`nextRaw` (the rule
 * reads text, not tags) and the `closers` a healed hyphen may be hiding behind. A `log` collects the
 * decisions for a builder's review report.
 */
export function joinWrapped(acc, next, { prevRaw = acc, nextRaw = next, closers, log } = {}) {
	if (!acc) return next;
	const decision = explainWrap(prevRaw, nextRaw);
	log?.record(decision);
	if (decision.heal) return healWrap(acc, closers) + next;
	return decision.tight ? acc + next : `${acc} ${next}`;
}

/** The wrap decisions a parse made, so a builder can report the ones that were judgement calls. */
export class WrapLog {
	constructor() { this.decisions = []; }
	record(decision) { this.decisions.push(decision); }
	/** Every non-routine decision, one line each: the pair as broken, the outcome, and why. Repeats
	 *  collapse — the same word reaches this log once per pass a parse makes over its lines. */
	report() {
		const lines = this.decisions.filter((d) => d.notable)
			.map((d) => `${d.pair} — ${d.heal ? "healed" : "kept"} (${d.reason})`);
		return [...new Set(lines)];
	}
}
