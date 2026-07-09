// Extract Book II "Steading improvement" callout boxes into improvement choice-groups — the same
// shape the hand-authored Book I improvements use (see packs/src/steading-improvements/market.json):
// an `entry` title row (name + flavor), plain `entry` rows for the interstitial/payoff prose, and
// pick rows each carrying a `track.max` counted from the box's □ checkboxes. Document order is
// preserved, so the group reads exactly like the printed box.
//
// Shared by build-improvements.js (writes the items) and build-journal.js (links each callout title
// to its item). Pure over the extractArticle() document — no PDF/Foundry access — so it is unit
// tested directly in tests/import/pdf/improvements.test.js. Reuses arcana-parse's markdown/slug
// helpers rather than re-deriving them.
import { joinMd, unlockSlug, titleCase } from "./arcana-parse.js";
import { deterministicId } from "../ids.js";
import { toSlug } from "../../../src/utils/slug.js";

const SYSTEM = "stonetop";
// Both the hand-authored Stonetop-core improvements and the Book II wonder improvements live in the
// one `steading-improvements` pack (under the stonetop/ and additional/ source folders respectively).
// build-improvements.js owns + regenerates the additional/ folder; this constant scopes the UUIDs and
// deterministic item IDs it stamps.
export const IMPROVEMENTS_PACK = "steading-improvements";

/** The compendium UUID a generated improvement item resolves to (deterministic from its slug, so
 *  the journal can link to it without the item build having run first). */
export const improvementUuid = (slug) =>
	`Compendium.${SYSTEM}.${IMPROVEMENTS_PACK}.Item.${deterministicId(IMPROVEMENTS_PACK, slug)}`;

// A call-out heading arrives dot-flanked from the book (".  steading improvement  ."); strip the
// flanking dots the same way the renderer does before matching.
const calloutText = (t) => { const m = (t || "").trim().match(/^\.\s+(.+?)\s+\.$/); return (m ? m[1] : t || "").trim(); };
const isImprovementHeading = (b) => b.type === "heading" && /^steading improvement$/i.test(calloutText(b.line.text));

// The □/◻ pick checkboxes in one list item — the leading marker plus any inline ones (e.g. Barrier
// Pass's "Convincing at least two of the □ Honored Sages" and "…, □ each in a different season",
// which each carry two boxes → track max 2).
const countChecks = (lines) => (lines.map((l) => l.text).join(" ").match(/[□◻]/g) || []).length;

/** Split a title checkbox item into its bold name + regular flavor. The book bolds the improvement
 *  name (small-caps, so "TRADE WITH BARRIER PASS"), then continues with the plain flavor line. The
 *  name can span several bold runs across wrapped lines, so the whole leading bold run is the name;
 *  it is title-cased ("Trade with Barrier Pass") to match the hand-authored items. */
function splitTitle(lines) {
	const md = joinMd(lines);
	const m = md.match(/^((?:\*\*[\s\S]*?\*\*\s*)+)([\s\S]*)$/);
	const name = titleCase((m ? m[1] : md).replace(/\*\*/g, "").replace(/\s+/g, " ").trim());
	const text = m ? m[2].trim() : "";
	return { name, text };
}

/** A call-out's content blocks → { name, list, titleItem }. The first list item is the improvement's
 *  name/flavor (no track); every later list item is a pick row with a □-counted track; paragraphs
 *  (interstitial "Requires…" lines and the trailing payoff) become plain entry rows, in book order. */
function choicesFromBlocks(blocks) {
	const list = [];
	let name = null, titleItem = null;
	const seen = new Map();
	const uniqSlug = (s) => { const n = (seen.get(s) || 0) + 1; seen.set(s, n); return n === 1 ? s : `${s}-${n}`; };
	for (const b of blocks) {
		if (b.type === "para") { list.push({ type: "entry", content: { title: null, text: joinMd(b.lines) } }); continue; }
		if (b.type !== "list") continue;
		for (const item of b.items) {
			if (!titleItem) { // the first list item is the improvement's name + flavor
				const t = splitTitle(item);
				name = t.name; titleItem = item;
				list.push({ type: "entry", content: { title: t.name, text: t.text } });
			} else { // a requirement pick row
				const text = joinMd(item);
				list.push({ type: "entry", slug: uniqSlug(unlockSlug(text)), content: { title: null, text }, track: { max: countChecks(item) || 1 } });
			}
		}
	}
	return { name, list, titleItem };
}

/**
 * Find every "Steading improvement" call-out in an extracted article and parse each into an
 * improvement descriptor `{ slug, name, choices, titleItem }`. The call-out's content is the run of
 * list/paragraph blocks immediately after its heading (the book sometimes frames it in a box and
 * sometimes doesn't — anchoring on the heading catches both, stopping at the next heading/image/rule).
 * `titleItem` is a reference to the title list item within `art`, so build-journal can stamp it with
 * the item UUID for in-place linking. A call-out with no parsable name is skipped (reported by the caller).
 */
export function extractImprovements(art) {
	const out = [];
	for (const section of art.sections || [])
		for (const side of ["left", "right"])
			for (const col of section[side] || []) {
				const blocks = col.blocks || [];
				for (let i = 0; i < blocks.length; i++) {
					if (!isImprovementHeading(blocks[i])) continue;
					// The call-out content is the following list/paragraph blocks; a decorative image can be
					// interleaved (Tempest Lords, Golden Oak) — skip it. Any other block (a heading, rule,
					// or box frame) ends the call-out.
					const content = [];
					let j = i + 1;
					for (; j < blocks.length; j++) {
						const t = blocks[j].type;
						if (t === "image") continue;
						if (t === "list" || t === "para") content.push(blocks[j]);
						else break;
					}
					const { name, list, titleItem } = choicesFromBlocks(content);
					if (name) { const slug = toSlug(name); out.push({ slug, name, choices: { slug, list }, titleItem }); }
					i = j - 1;
				}
			}
	return out;
}
