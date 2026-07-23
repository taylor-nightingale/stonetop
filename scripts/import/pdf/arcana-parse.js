// Map a per-arcanum block chunk (from layout.js extractArticle) to the ArcanumData shape
// (src/data/ArcanumData.js front/back). The checkbox glyphs □/◻ (pick/track), ◇ (item load pip) and
// ○/◯ (resource/loyalty) are injected by load.js from the vector layer; circles also arrive as the
// font's text-layer "l" glyph in some tracks.
//
// Pure helpers (parseTrack/stripMarkers/splitLoyalty/parseItemLine/unlockSlug/joinMd) are unit-tested
// in tests/import/pdf/arcana-parse.test.js. parseFront/parseBack are exercised via build-arcana's
// divergence report against the hand-authored JSON.
import { isItalic, isBoldBody, isDingbat } from "./fonts.js";
import { toSlug } from "../../../src/utils/slug.js";
import { qualifyTable, tableUuid, TABLE_PACK } from "./tables.js";
import { deterministicId } from "../ids.js";

// ─── spans → markdown ─────────────────────────────────────────────────────────
const MD = { b: ["**", "**"], i: ["*", "*"], bi: ["**_", "_**"] };
const emphOf = (f) => (isItalic(f) && isBoldBody(f) ? "bi" : isItalic(f) ? "i" : isBoldBody(f) ? "b" : "");

function mdSpans(spans, { keepDiamonds = false } = {}) {
	const toks = [];
	for (const s of spans) {
		// Marker/dingbat glyphs are layout artifacts, not prose — except an inline ◇, which the book
		// uses as an item-weight marker inside a sentence ("Retrieve an ◇◇ acorn"); a caller that
		// wants those keeps them as plain-text tokens via keepDiamonds.
		if ((isDingbat(s.font) || s.font === "marker") && !(keepDiamonds && s.text.trim() === "◇")) continue;
		const emph = s.font === "marker" ? "" : emphOf(s.font);
		const last = toks[toks.length - 1];
		if (last && last.emph === emph) last.text += s.text;
		else toks.push({ emph, text: s.text });
	}
	let out = "";
	for (const t of toks) {
		if (!t.emph) { out += t.text; continue; }
		const m = t.text.match(/^(\s*)(.*?)(\s*)$/s);
		out += m[2] ? `${m[1]}${MD[t.emph][0]}${m[2]}${MD[t.emph][1]}${m[3]}` : t.text;
	}
	return out;
}

/** Join lines to one markdown string; de-hyphenate, keep "…" options on their own line.
 *  `keepDiamonds` preserves inline ◇ item-weight markers in the text (leading bullet glyphs are
 *  still stripped), setting adjacent ones tight ("◇◇") as printed. */
export function joinMd(lines, { keepDiamonds = false } = {}) {
	let out = "", prev = null;
	for (const l of lines) {
		const h = mdSpans(l.spans, { keepDiamonds }).replace(/^[□◻◇○◯]\s*/, "").trim();
		const raw = l.text.trim();
		if (prev == null) out = h;
		else if (/^(?:…|\.\.\.)/.test(raw)) out += "\n" + h;
		else if (/[A-Za-z]-$/.test(prev) && /^[a-z]/.test(raw)) out = out.replace(/-((?:[*_]+)?)$/, "$1") + h;
		else out += " " + h;
		prev = raw;
	}
	// Straighten curly double-quotes (the book's typography) to ASCII " — keeps the JSON clean.
	out = out.replace(/[“”]/g, '"').replace(/[ \t]{2,}/g, " ").trim();
	// Kept diamonds arrive as one glyph per vector marker ("◇ ◇") — set them tight, as printed.
	return keepDiamonds ? out.replace(/◇(?:\s+◇)+/g, (m) => m.replace(/\s+/g, "")) : out;
}

// ─── pure helpers ─────────────────────────────────────────────────────────────
const MARK = /[□◻○◯◇]/g;

/** Remove box/circle/diamond glyphs from text (keeps markdown emphasis), collapse spaces. */
export function stripMarkers(text) {
	return text.replace(MARK, "").replace(/\s{2,}/g, " ").trim();
}

/** Clean a disguise tag line ("*magical, terrifying*") to a plain tag string ("magical, terrifying").
 *  Drops markers and markdown emphasis and a leading separator comma; null when empty. Used for a front
 *  whose object has no `◇` load pip — the arcanum's descriptive tags, not a carried outfit item. */
export function tagText(text) {
	return text.replace(MARK, "").replace(/[*_]/g, "").replace(/^[\s,]+/, "").replace(/\s{2,}/g, " ").trim() || null;
}

// A write-in blank in the book is printed as a run of underscores (a line to fill in). tagText above
// strips them from tag lines; in flowing prose they survive to become editable fields (see below).
const BLANK = /_{2,}/g;

/** An "assign one die to each" paragraph prints several fill-in rows on one flattened line, each led by
 *  a blank and a bold label ("____ **Onset:** …  ____ **Intensity:** …"). Split it back into one
 *  markdown list item per row so each blank stands on its own line. Only fires with ≥2 blank-then-bold
 *  rows, so a mid-sentence blank (e.g. a geas "you must never again ____") is left inline. */
export function splitAssignRows(text) {
	if (!text) return text;
	const ROW = /_{2,}\s*\*\*/g;
	if ((text.match(ROW) || []).length < 2) return text;
	return text.split(/\s+(?=_{2,}\s*\*\*)/).map((r) => r.trim()).filter(Boolean).map((r) => `- ${r}`).join("\n");
}

/** Number every write-in blank across an arcanum's text fields in a fixed reading order, mutating them
 *  in place: each `____` run becomes an `@Blank[n]` token (n counting up from 0 across front then back).
 *  The blank-field enricher renders each token as an editable input; the typed value persists in the
 *  arcanum's `choiceValues.blanks` store under that key, so the numbering must be stable. Idempotent —
 *  an already-tokenised text has no bare underscore runs left to match. Returns how many were numbered. */
export function numberBlanks(system) {
	if (!system) return 0;
	let n = 0;
	const number  = (text) => (text == null ? text : text.replace(BLANK, () => `@Blank[${n++}]`));
	const entries = (group) => { for (const row of group?.list ?? []) if (row?.content) row.content.text = number(row.content.text); };
	const { front, back } = system;
	if (front) { front.description = number(front.description); entries(front.unlock); }
	if (back) {
		back.description = number(back.description);
		for (const m of back.moves ?? []) m.text = number(m.text);
		entries(back.choices);
		entries(back.consequences);
	}
	return n;
}

/** A run of N checkbox glyphs → `{max:N}` plus the residual text. Counts box/circle/diamond glyphs
 *  anywhere, plus a *pure* run of the font's text-layer circle glyph ("l l l l l"). */
export function parseTrack(raw) {
	const boxes = (raw.match(MARK) || []).length;
	const stripped = raw.replace(MARK, "").trim();
	const lRun = /^(?:l\s*)+$/.test(stripped) ? (stripped.match(/l/g) || []).length : 0;
	return { max: boxes + lRun, text: lRun ? "" : stripped.replace(/\s{2,}/g, " ").trim() };
}

/** Strip the "(Loyalty ◯◯◯)" annotation from a follower cost line. Loyalty is always max 3 (the
 *  schema default), so the marker count is discarded — we only want the clean cost text. Handles the
 *  book's noise: a "Loyalty:" colon, stray ○/l markers trailing the paren, and a loyalty-only line
 *  (no real cost) → "". */
export function stripLoyalty(costRaw) {
	return (costRaw || "")
		.replace(/\(\s*loyalty[:\s○◯l]*\)/ig, " ")   // a parenthesized "(Loyalty …)" anywhere
		.replace(/\(\s*loyalty[:\s○◯l]*$/i, " ")      // an unclosed trailing "(Loyalty" (its pips/")" were stranded in another block)
		.replace(/\bloyalty[:\s○◯l]*$/i, " ")         // a bare trailing "Loyalty ◯◯◯" (loyalty-only cost)
		.replace(/[○◯]/g, " ")                         // any leftover stray circle markers
		.replace(/\s{2,}/g, " ")
		.trim()
		.replace(/[,\s]+$/, "");
}

// ─── follower wiring / detection ────────────────────────────────────────────────
/** The single-pick choice row that links an arcanum to one of its followers — the follower IS
 *  the row (empty content, full card shown inline). Mirrors the hand-authored `beautiful-scroll`
 *  back. `hideFromFollowersTab` keeps a card-resident follower (the Ring) off the followers tab. */
export function followerChoiceEntry(followerSlug, { hideFromFollowersTab = false } = {}) {
	return { type: "entry", slug: followerSlug, content: { title: null, text: "" }, track: { max: 1 },
		followers: { slugs: [followerSlug], inlineDisplay: true, hideFromFollowersTab } };
}

/** The back-side choice group that inlines an arcanum's follower(s), or null if it has none. Same
 *  shape majors use (mindgem/blackwood); lets a regenerated minor back (e.g. cracked-flute) show its
 *  follower the way majors do. */
export function followerChoices(arcanaSlug, followerSlugs) {
	if (!followerSlugs?.length) return null;
	return { slug: arcanaSlug, list: followerSlugs.map(followerChoiceEntry) };
}

/** A real arcanum follower stat block carries a small creature marker icon (~15–18px); the card's
 *  border decoration (~42px) and icon-less fragments are false positives, as are numeric page-number
 *  "names". Used to filter `statblock` blocks before parsing followers. */
export function isArcanaFollower(block) {
	const w = block?.icon?.w;
	if (!(typeof w === "number" && w < 25)) return false;
	const first = (block.lines || []).find((l) => (l.text || "").trim());
	return !!first && !/^\d+$/.test(first.text.trim());
}

/** Match a page's marker icons to named follower headings. A back-side MAJOR follower (Astor/Halix on
 *  the Blackwood Fetishes back, the Mighty Servant on the Mindgem back) prints an ~18px creature marker
 *  immediately left of its name heading, on the same baseline — but the layout parser doesn't recognize
 *  these as stat blocks (they're hand-authored), so `isArcanaFollower`'s icon path never sees them.
 *  This locates the marker sitting just left of each named heading so build-arcana can stamp it onto the
 *  preserved follower doc. A marker is a small image (`w < 25`); it pairs with the heading whose
 *  normalized text equals one of `names` and whose left edge sits just right of the marker on the same
 *  baseline. Returns [{ name, iconFile }] (the caller's original `names` spelling, with its icon file). */
export function matchFollowerIcons(lines, images, names) {
	const targets = new Map((names || []).map((n) => [toSlug(n), n])); // slug -> original spelling
	const markers = (images || []).filter((im) => im?.file && typeof im.w === "number" && im.w < 25);
	const out = [];
	for (const im of markers) {
		const right = im.x + im.w;
		const line = (lines || []).find((l) => {
			const slug = toSlug((l.text || "").trim());
			if (!targets.has(slug)) return false;
			return Math.abs((l.bbox?.[1] ?? 0) - im.y) <= 8 && (l.bbox?.[0] ?? 0) - right >= 0 && (l.bbox?.[0] ?? 0) - right < 25;
		});
		if (line) out.push({ name: targets.get(toSlug(line.text.trim())), iconFile: im.file });
	}
	return out;
}

/** The item tags line under a title → an outfit-item-shaped object (name = arcanum name, weight from
 *  ◇ pips). The book italicizes tags (`*close*`) and leaves stats/notes plain (`+1 damage`), so the
 *  italic runs become `tags` and the remaining plain text becomes `note`. null when there's nothing. */
export function parseItemLine(text, { name, pips = 0 } = {}) {
	const diamonds = (text.match(/◇/g) || []).length;
	// The book sometimes bold-wraps the separating commas (`*a***,** *b*`); bold is never meaningful on
	// an item line, and it corrupts the italic-run (tags) extraction — strip it so only tag italics remain.
	const body = text.replace(/[◇○□◻◯]/g, "").replace(/\*\*/g, "").replace(/\s{2,}/g, " ").trim();
	const clean = (parts) => parts.flatMap((p) => p.split(",")).map((s) => s.trim()).filter(Boolean).join(", ") || null;
	const tags = clean([...body.matchAll(/\*([^*]+)\*/g)].map((m) => m[1]));       // italic runs → tags
	const note = clean([body.replace(/\*[^*]+\*/g, " ")]);                          // plain remainder → note
	if (!tags && !note && !pips && !diamonds) return null;
	return { name, weight: pips || diamonds || 1, tags, note, inventoryColumn: "regular" };
}

const STOP = new Set("a an the to of and or you your must can will would it its is are be with for from while into on at".split(" "));
/** A deterministic kebab slug from an unlock option's salient words (editorial slugs aren't
 *  mechanically reproducible; this is stable + readable). */
export function unlockSlug(text) {
	const words = stripMarkers(text).toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w));
	return toSlug(words.slice(0, 2).join(" ")) || "step";
}

// ─── major arcana helpers ───────────────────────────────────────────────────────
const MINOR_WORDS = new Set("a an the and or but for nor to in on at by with from as of".split(" "));
/** Title-case an ALL-CAPS mystery-move name, lowercasing minor words except the first
 *  ("SPIRITS OF THE HERD" → "Spirits of the Herd", "A FLICKERING FLAME" → "A Flickering Flame"). */
export function titleCase(s) {
	const words = (s || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
	return words.map((w, i) => (i > 0 && MINOR_WORDS.has(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/** A mystery move whose text begins "(Requires: A, B)" gates on those moves — pull the comma-listed
 *  move names into `requirement.moves` (display names, mirroring `call-the-spirits`) and strip the
 *  parenthetical from the text. Returns { moves: string[]|null, text }. */
export function parseRequires(text) {
	const m = (text || "").match(/^\(Requires?:\s*([^)]+)\)\s*/i);
	if (!m) return { moves: null, text };
	const moves = m[1].split(",").map((s) => s.trim()).filter(Boolean);
	return { moves: moves.length ? moves : null, text: text.slice(m[0].length) };
}

// The stat a "roll +X" gates on → the MoveData.rollStat key. Accepts the book's abbreviations and full
// words; "+nothing" is a genuine 2d6+0 roll (the flesh-remembers), which the "prompt" key rolls (no
// modifier). An unrecognized token means "no identifiable roll" → the move isn't made rollable.
const ROLL_STAT = { str: "str", strength: "str", dex: "dex", dexterity: "dex", con: "con", constitution: "con",
	int: "int", intelligence: "int", wis: "wis", wisdom: "wis", cha: "cha", charisma: "cha", nothing: "prompt" };

// A PbtA result tier header inside move text: "on a 10+" / "on a 7-9" / "on a 6-", tolerant of the
// book's markdown noise — the bold can wrap or split it ("**on a** **10+**"), and a comma/colon can sit
// inside or after the bold ("**on a 7-9,**"). The `[*\s]*` separators swallow any mix of asterisks and
// spaces on either side of the tier token. Global + case-insensitive so all three tiers are scanned.
const TIER_RE = /[*\s]*on\s+a[*\s]*(10\s*\+|7\s*[-–]\s*9|6\s*[-–])[,:*\s]*/gi;
const TIER_KEY = (tok) => (/10/.test(tok) ? "success" : /7/.test(tok) ? "partial" : "failure");
const cleanTier = (s) => (s || "").replace(/^[\s,;:]+/, "").replace(/[\s,;]+$/, "").trim();

/** Extract the three result-tier outcomes from a rollable move's text. Each tier's value runs from the
 *  end of its header to the next tier header OR the next newline, whichever comes first — the tiers are
 *  written inline on one "roll …:" sentence, so this captures the outcome and stops before the option
 *  bullets / trailing paragraphs that follow. Absent tiers get "". Returns null with no 10+ header. */
function extractMoveResults(text) {
	const t = text || "";
	const hits = [];
	for (const m of t.matchAll(TIER_RE)) hits.push({ key: TIER_KEY(m[1]), start: m.index, end: m.index + m[0].length });
	if (!hits.some((h) => h.key === "success")) return null;
	const values = { success: "", partial: "", failure: "" };
	for (let i = 0; i < hits.length; i++) {
		const nextMarker = hits[i + 1] ? hits[i + 1].start : Infinity;
		const nl = t.indexOf("\n", hits[i].end);
		const stop = Math.min(nextMarker, nl < 0 ? Infinity : nl, t.length);
		values[hits[i].key] = cleanTier(t.slice(hits[i].end, stop));
	}
	return {
		success: { label: "10+", value: values.success },
		partial: { label: "7-9", value: values.partial },
		failure: { label: "6-",  value: values.failure },
	};
}

/** Parse a move's text for its roll: the "+X" stat and the three result-tier outcomes. Gated on an
 *  actual "roll +X" so passive moves that merely mention "on a 10+" (inescapable-pull) stay non-rollable.
 *  Returns { rollStat, moveResults } — either may be null. */
export function parseMoveRoll(text) {
	const m = (text || "").match(/\broll\s*\+\s*([A-Za-z]+)/i);
	const rollStat = m ? (ROLL_STAT[m[1].toLowerCase()] ?? null) : null;
	if (!rollStat) return { rollStat: null, moveResults: null };
	return { rollStat, moveResults: extractMoveResults(text) };
}

// A move header's right-aligned resource track is a run of ○ pips (Azure Hand's Battery, Ice Sphere's
// Mindwalking, Storm Markings' Storm's Fury — "hold N Power/Fury"). load.js injects each pip as its own
// far-right `marker` line, but the layout's column split strands them (they glom onto whatever text sits
// mid-right), so read them straight from the raw page lines here. Pips live far right (excludes inline
// "(○○○ uses)" / follower loyalty circles at ~x480); a move header's □ checkbox + name sit at the left.
const RES_PIP_X = 600; // a resource pip's left edge — comfortably right of any body/loyalty circle
const RES_HEAD_X = 470; // a move header / □ checkbox column's right bound

/** Read the right-aligned resource tracks off ONE back page's raw lines. Each ○ run is matched to the
 *  move whose □ header sits just above it; `hasBlank` marks the dotted fill-in line that trails a track
 *  ending well short of the body's right edge (Battery's write-in). A trailing □ (the separate mark box
 *  on Mindwalking / Storm's Fury) is ignored — only ○ pips count toward `max`. Returns
 *  [{ slug, max, hasBlank }]. Call per page: run y-bands are unique within a page, not across the book. */
export function resourceTracks(lines) {
	// A follower stat block's "(Loyalty ○○○)" circles can land right of RES_PIP_X too (the Cost line sits
	// in the block's right column, e.g. Blackwood Fetishes' Astor/Halix). They aren't a move resource —
	// drop any pip run that shares a y-band with a "Loyalty" text line.
	const loyaltyYs = lines.filter((l) => l.font !== "marker" && /loyalt/i.test(l.text)).map((l) => l.bbox[1]);
	const pips  = lines.filter((l) => l.font === "marker" && l.text.includes("○") && l.bbox[0] > RES_PIP_X
		&& !loyaltyYs.some((y) => Math.abs(y - l.bbox[1]) <= 5))
		.sort((a, b) => a.bbox[1] - b.bbox[1]);
	if (!pips.length) return [];
	const boxes = lines.filter((l) => l.font === "marker" && l.text.includes("□") && l.bbox[0] < RES_HEAD_X)
		.sort((a, b) => a.bbox[1] - b.bbox[1]);
	const bodyRight = Math.max(0, ...lines.filter((l) => l.font !== "marker" && l.bbox[0] < RES_HEAD_X).map((l) => l.bbox[2]));
	// Group pips into runs by y-band (each pip is its own line; a run's max is its pip count).
	const runs = [];
	for (const p of pips) {
		const n = (p.text.match(/○/g) || []).length;
		const last = runs[runs.length - 1];
		if (last && Math.abs(p.bbox[1] - last.y) <= 4) { last.max += n; last.x1 = Math.max(last.x1, p.bbox[2]); }
		else runs.push({ y: p.bbox[1], max: n, x1: p.bbox[2] });
	}
	const tracks = [];
	for (const run of runs) {
		const box = [...boxes].reverse().find((b) => b.bbox[1] <= run.y + 6); // nearest □ header at/above the run
		if (!box) continue;
		const head = lines.find((l) => l.font !== "marker" && Math.abs(l.bbox[1] - box.bbox[1]) <= 3
			&& l.bbox[0] >= box.bbox[0] && l.bbox[0] < RES_HEAD_X + 40);
		const name = head ? majorMoveName(head.text).name : "";
		if (!name) continue;
		tracks.push({ slug: toSlug(titleCase(name)), max: run.max, hasBlank: run.x1 < bodyRight - 40 });
	}
	return tracks;
}

/** Split a major move header line's leading ALL-CAPS run (the move name) from any inline remainder
 *  ("WHISPERS When you grip the shaft" → {name:"WHISPERS", rest:"When you grip the shaft"}). */
export function majorMoveName(text) {
	const words = stripMarkers(text).trim().split(/\s+/);
	let n = 0;
	while (n < words.length && /^[A-Z0-9][A-Z0-9'’-]*$/.test(words[n])) n++;
	if (n < 1) return { name: "", rest: words.join(" ") };
	return { name: words.slice(0, n).join(" "), rest: words.slice(n).join(" ") };
}

/** The front's mark-gate count for unlocking the mysteries: an explicit "marked N", or the length of
 *  the standalone Marks run for "the last mark". Stored on `back.unlockAt`. */
export function detectUnlockAt(blocks) {
	const text = blocks.map((b) => b.type === "list" ? rawOf(b.items.flat()) : (b.lines ? rawOf(b.lines) : (b.line?.text ?? ""))).join(" ");
	if (!/unlock/i.test(text)) return null;
	const m = text.match(/marked\s+(\d+)/i);
	if (m) return Number(m[1]);
	if (/last mark/i.test(text)) {
		let max = 0;
		for (const b of blocks) if (b.type === "list") for (const it of b.items) { const { max: mx, text: t } = parseTrack(rawOf(it)); if (!t && mx > max) max = mx; }
		return max || null;
	}
	return null;
}

// ─── blocks → front/back ──────────────────────────────────────────────────────
const markerKind = (line) => { const t = (line?.text || "").trim(); return /^[□◻]/.test(t) ? "square" : /^◇/.test(t) ? "diamond" : /^[○◯]/.test(t) ? "circle" : null; };
const rawOf = (lines) => (lines || []).map((l) => l.text).join(" ");
const isHead = (b, re) => (b?.type === "heading" || b?.type === "title") && re.test(b.line.text.trim());

/** Split a front-side follower stat block out of a major front's block stream (the Ring of Daagon
 *  prints its follower on the card FRONT — "The ring itself becomes a follower"). The segment is a
 *  SECOND heading (the follower's name; the first is the card's own) followed by a tags-flagged
 *  para, and runs to the end of the front. Because the column split scrambles the card's tail, the
 *  segment's list items are triaged: a pure checkbox run is the unlock's Marks track (re-attached
 *  to the remaining front blocks as its own list), a letter-less ○-pip run is the cost line's
 *  stranded "(Loyalty ○○○)" (counted, dropped), and everything else (the ä move bullets) belongs
 *  to the stat block. A lone short italic para is the CARD's displaced tag line (printed under the
 *  title, stranded here by the split) — returned separately for `front.tags`. Rules, images and
 *  side labels drop (the follower's marker icon is resolved separately, off its name heading, via
 *  matchFollowerIcons).
 *  Returns { blocks, followerLines, loyaltyMax, cardTagsMd }. */
export function splitFrontFollower(blocks) {
	let at = -1, seenHeading = false;
	for (let i = 0; i < blocks.length && at < 0; i++) {
		const b = blocks[i];
		if (b.type !== "heading" && b.type !== "title") continue;
		if (isHead(b, /^(front|back)$/i)) continue;
		if (!seenHeading) { seenHeading = true; continue; } // the card's own name heading
		const next = blocks.slice(i + 1, i + 3).find((n) => n.type === "para" || n.type === "list");
		if (next?.type === "para" && next.tags) at = i;
	}
	if (at < 0) return { blocks, followerLines: null, loyaltyMax: 0, cardTagsMd: null };

	const remaining = blocks.slice(0, at);
	const followerLines = [blocks[at].line];
	let loyaltyMax = 0, cardTagsMd = null;
	for (const b of blocks.slice(at + 1)) {
		if (b.type === "image") continue; // marker icon drops (resolved via matchFollowerIcons off the name heading)
		if (b.type === "para") {
			const md = joinMd(b.lines);
			if (/^\*[^*]+\*$/.test(md) && md.length < 40) { cardTagsMd = cardTagsMd ?? md; continue; }
			followerLines.push(...b.lines);
		} else if (b.type === "list") {
			for (const item of b.items) {
				const raw = rawOf(item);
				const { max, text } = parseTrack(raw);
				const residualLetters = /[a-z]/i.test(stripMarkers(raw).replace(/[()]/g, ""));
				if (max > 0 && !text && !/[○◯]/.test(raw)) remaining.push({ type: "list", items: [item] });
				else if (max > 0 && /[○◯]/.test(raw) && !residualLetters) loyaltyMax += (raw.match(/[○◯]/g) || []).length;
				else followerLines.push(...item);
			}
		}
		// rules / side labels / tables drop
	}
	return { blocks: remaining, followerLines, loyaltyMax, cardTagsMd };
}

/** Build the front side from its blocks (already bounded to one card's front). */
export function parseFront(blocks, { name, slug }) {
	const front = { title: name, item: null, tags: null, description: null, unlock: null };
	// A card that prints its follower on the FRONT (the Ring of Daagon) carries a second stat-block
	// heading + tags para inside the front span. Pull it out before parsing the unlock, and stash the
	// raw follower lines on the front for build-arcana to turn into a follower doc + unlock entry.
	const ff = splitFrontFollower(blocks);
	if (ff.followerLines) {
		blocks = ff.blocks;
		front._frontFollower = { lines: ff.followerLines, loyaltyMax: ff.loyaltyMax };
		// ff.cardTagsMd is the arcanum's own "*magical*" tag, stranded in the follower span by the column
		// split. No major front captures a tags line (the parser drops them uniformly), so it's discarded
		// here too — pulling it aside just keeps it out of the follower's moves.
	}
	let item = null, pips = 0;
	const seq = []; // ordered { kind, text?, lines? }

	for (const b of blocks) {
		if (b.type !== "para" && b.type !== "list") continue;
		const raw = b.type === "list" ? rawOf(b.items.flat()) : rawOf(b.lines);
		// pips-only block ("◇" / "◇ ◇") sets the item load
		if (!seq.length && /◇/.test(raw) && !/[A-Za-z]/.test(raw)) { pips += (raw.match(/◇/g) || []).length; continue; }
		// The disguise line under the title (a layout-tagged tags para, or — testing the *raw* text, since
		// the book sometimes bold-wraps the comma as `**,**` so the markdown would start with "*" — a line
		// leading with the item's `◇` load pip or a bare comma), before any option content.
		if (!item && !front.tags && !seq.length) {
			const oneLine = b.type === "para" ? joinMd(b.lines) : b.items.length === 1 ? joinMd(b.items[0]) : null;
			if (oneLine != null && (b.tags || /^\s*◇/.test(raw) || /^,/.test(raw.replace(/^[◇○□◻\s]+/, "")))) {
				// Load pips (◇) can sit inline on the item line, where joinMd strips only the first marker
				// glyph — count them from the raw text so a 2-pip item (rune-laden-scales) weighs 2.
				const inlinePips = ((b.type === "para" ? rawOf(b.lines) : rawOf(b.items[0])).match(/◇/g) || []).length;
				// The `◇` diamond is the outfit-item marker. With it (inline, or a preceding pips-only block)
				// the disguise IS a carried item; without it the line is just the arcanum's descriptive tags.
				if (inlinePips + pips > 0) item = parseItemLine(oneLine, { name, pips: pips + inlinePips });
				else front.tags = tagText(oneLine);
				continue;
			}
		}
		if (b.type === "list") for (const it of b.items) seq.push({ kind: "li", lines: it });
		else seq.push({ kind: "para", lines: b.lines });
	}
	front.item = item;

	// MAJOR-style unlock: the options are bold-italic "When you **_…_**" trigger paragraphs, each
	// accreting its following option bullets / continuation paras; task checkboxes and the Marks run are
	// their own tracked entries. (Minors have no such triggers — they fall through to the li logic below.)
	const isTriggerPara = (s) => s.kind === "para" && /^When you \*\*_/i.test(joinMd(s.lines).trim());
	if (seq.some(isTriggerPara)) {
		const firstTrig = seq.findIndex(isTriggerPara);
		front.description = seq.slice(0, firstTrig).map((s) => joinMd(s.lines)).filter(Boolean).join("\n\n") || null;
		const list = [];
		let cur = null;
		const flushCur = () => { if (cur) list.push(cur); cur = null; };
		for (const s of seq.slice(firstTrig)) {
			if (isTriggerPara(s)) {
				flushCur();
				cur = { type: "entry", content: { title: null, text: stripMarkers(joinMd(s.lines)) } };
			} else if (s.kind === "li") {
				const { max, text: residual } = parseTrack(rawOf(s.lines));
				if (max > 0 && !residual) { flushCur(); list.push({ type: "entry", slug: "marks", content: { title: null, text: "Marks" }, track: { max } }); }
				else if (max > 0) { flushCur(); const t = stripMarkers(joinMd(s.lines)); const row = { type: "entry", content: { title: null, text: t } }; if (t) row.slug = unlockSlug(t); row.track = { max }; list.push(row); }
				else if (cur) cur.content.text += "\n- " + stripMarkers(joinMd(s.lines)).replace(/^[ä••\-\s]+/, ""); // an option bullet of the current trigger
			} else if (cur) cur.content.text += "\n\n" + stripMarkers(joinMd(s.lines)); // a continuation para (trailing orphans drop with no cur)
		}
		flushCur();
		// Drop the trailing gate instruction ("When you make the last mark, you unlock …") after the track.
		if (list.some((e) => e.track)) while (list.length && !list[list.length - 1].track) list.pop();
		front.unlock = { slug, list };
		return front;
	}

	// description = paras before the first option (li); unlock = the intro para + every li/para after.
	const firstLi = seq.findIndex((s) => s.kind === "li");
	if (firstLi < 0) {
		front.description = seq.map((s) => joinMd(s.lines)).filter(Boolean).join("\n\n") || null;
		return front;
	}
	// The intro entry is the para right before the first option; majors precede it with several
	// bold-italic "When you **_…_**" trigger paras that are unlock entries too — pull them all in.
	const isTrigger = (s) => s?.kind === "para" && /^When you \*\*_/i.test(joinMd(s.lines).trim());
	let introAt = Math.max(0, firstLi - 1);
	while (introAt > 0 && isTrigger(seq[introAt - 1])) introAt--;
	front.description = seq.slice(0, introAt).map((s) => joinMd(s.lines)).filter(Boolean).join("\n\n") || null;

	const list = [];
	for (const s of seq.slice(introAt)) {
		const raw = rawOf(s.lines);
		const { max, text: residual } = parseTrack(raw); // residual is "" for a pure run ("l l l l" / "○ ○ ○")
		const text = stripMarkers(joinMd(s.lines));
		if (max > 0 && !residual) {
			if (/^[\s◇]+$/.test(raw)) continue; // a stray item load pip (◇) grouped into the list — not a track
			// A standalone marker run ("l l l l l" / "○ ○ ○") is the Marks track (its length is the max).
			list.push({ type: "entry", slug: "marks", content: { title: null, text: "Marks" }, track: { max } });
		} else if (s.kind === "li" || max > 0) {
			const row = { type: "entry", content: { title: null, text } };
			if (text) row.slug = unlockSlug(text);
			if (max > 0) row.track = { max }; // a task checkbox is max 1; an embedded run keeps its count
			list.push(row);
		} else {
			list.push({ type: "entry", content: { title: null, text } });
		}
	}
	// Drop trailing non-tracked instruction paras that follow the task/Marks track (e.g. "When you make
	// the last mark, you unlock …") — they're informational, not unlock options.
	if (list.some((e) => e.track)) while (list.length && !list[list.length - 1].track) list.pop();
	front.unlock = { slug, list };
	return front;
}

/** Build a MAJOR back: "Mysteries of X" with all-caps mystery moves and a consequence track. Majors
 *  share the front's item (itemSameAsFront) and have no separate back item/description/resource. Each
 *  move (a `□ ALL-CAPS NAME` list item) and each consequence (a `□`-marked list item) continues
 *  through the following paras until the next list item / rule / heading. `unlockAt` is front-derived. */
function parseMajorBack(blocks, { slug, name, unlockAt }) {
	const back = { title: null, item: null, description: null, resource: null, itemSameAsFront: true, choices: null, moves: [], consequences: null, unlockAt: unlockAt ?? null };
	const abbr = toSlug((name || "").trim().split(/\s+/).pop() || "c") || "c"; // "Twisted Spear" → "spear"
	let section = null; // null | "moves" | "consequences"
	let cur = null;     // the move/consequence currently accreting following paras/bullets
	const consX = [];   // each consequence row's start x0, parallel to back.consequences.list
	const flush = () => {
		if (!cur) return;
		const text = cur.text.replace(/\n{3,}/g, "\n\n").trim();
		if (cur.kind === "move") {
			const nm = titleCase(cur.name);
			const { moves: reqMoves, text: body } = parseRequires(text);
			const move = { id: toSlug(nm), name: nm, text: body };
			if (reqMoves) move.requirement = { moves: reqMoves };
			back.moves.push(move);
		} else {
			(back.consequences ??= { slug: "consequences", list: [] });
			const row = { type: "entry", slug: `${abbr}-c${back.consequences.list.length + 1}`, content: { title: null, text } };
			if (cur.max > 0) row.track = { max: cur.max };
			back.consequences.list.push(row);
			consX.push(cur.x0 ?? null);
		}
		cur = null;
	};
	const bullet = (it) => "\n- " + stripMarkers(joinMd(it)).replace(/^[ä••\-\s]+/, "");
	for (const b of blocks) {
		if (b.type === "heading" || b.type === "title") {
			const t = b.line.text.trim();
			if (/^moves$/i.test(t)) { flush(); section = "moves"; }
			else if (/^consequences$/i.test(t)) { flush(); section = "consequences"; }
			else if (/^(front|back)$/i.test(t) || /^appendix [cd]/i.test(t)) { flush(); section = null; } // side label / running header ends back content
			else if (!back.title) back.title = t;
			continue;
		}
		if (b.type === "rule") { flush(); continue; } // a rule separates moves / consequences
		if (b.type === "boxstart" || b.type === "boxend" || b.type === "table" || b.type === "statblock" || b.type === "image") continue;
		if (section === "moves") {
			if (b.type === "list") for (const it of b.items) {
				const head = majorMoveName(it[0]?.text || "");
				const isWord = /^[A-Z][a-z]+\./.test(stripMarkers(it[0]?.text || "")); // a "□ Seal." option
				if (markerKind(it[0]) === "square" && head.name) {        // a "□ ALL-CAPS NAME" move header
					flush();
					const tail = stripMarkers(joinMd(it.slice(1)));
					cur = { kind: "move", name: head.name, text: [head.rest, tail].filter(Boolean).join(" ") };
				} else if (markerKind(it[0]) === "square" && isWord) {
					// A "□ Word." option (ineffable-words' Seal/Purify/Gather/Empower) folds into the move as
					// an option — a rule separates it from the header, so re-attach to the last move once flushed.
					const line = "\n- " + stripMarkers(joinMd(it));
					if (cur) cur.text += line; else if (back.moves.length) back.moves[back.moves.length - 1].text += line;
				} else if (cur) cur.text += bullet(it);                   // a sub-bullet of the current move
			} else if (b.type === "para" && cur) cur.text += "\n\n" + stripMarkers(joinMd(b.lines));
		} else if (section === "consequences") {
			if (b.type === "list") for (const it of b.items) {
				// A consequence is a "□"-marked item; the box may follow stray leading circle/diamond glyphs
				// (layout noise, e.g. norubas' "○ ○ □ …"). Its track is the box count only — circles there
				// aren't a consequence track (those are resource/loyalty markers elsewhere).
				if (/^[○◯◇\s]*[□◻]/.test((it[0]?.text || "").trim())) {
					flush();
					cur = { kind: "consequence", max: (rawOf(it).match(/[□◻]/g) || []).length, text: stripMarkers(joinMd(it)), x0: it[0]?.bbox?.[0] ?? null };
				} else if (cur) cur.text += bullet(it);
			} else if (b.type === "para" && cur) cur.text += "\n\n" + stripMarkers(joinMd(b.lines));
		}
	}
	flush();
	// An escalation consequence is tabbed in under its parent, ~13.5px right of the column base. Compare
	// each row's x0 against every sibling in the section, not a per-block base: an indented row can open
	// its own list block (mindgem's post-table pair), while a wrapped line misread as a row sits <8px in.
	if (back.consequences) back.consequences.list.forEach((row, i) => {
		const x = consX[i];
		if (x != null && consX.some((b) => b != null && x - b >= 8 && x - b <= 20)) row.indent = true;
	});
	// The book titles every major back "Mysteries of the X", but the heading isn't reliably tagged as a
	// heading for a few cards (staff / redwood / ineffable extract without it) — derive it when the title
	// heading wasn't captured. Cards whose heading IS captured keep it verbatim (e.g. the possessive
	// "Mysteries of Noruba's Ice Sphere", which drops the "the").
	if (!back.title && name) back.title = `Mysteries of the ${name}`;
	return back;
}

/** Join a block/line's spans into plain text, dropping the ZapfDingbats checkbox glyphs (the PDF
 *  renders a □-box as a stray "4"/"7" etc.) but KEEPING the marker-font ○/◇ pips and real digits (dice
 *  labels like 1d4). Feeding this to parseResourceLine lets it keep dice labels without the box noise. */
export const spanText = (lines) => (Array.isArray(lines) ? lines : [lines])
	.flatMap((l) => l?.spans ?? [{ text: l?.text ?? "" }])
	.filter((s) => s.font !== "ZapfDingbats").map((s) => s.text).join("");

/** A resource/track line, identified by its circle (○) pips (□ pick-boxes are consequences). Forms:
 *  a "Label:  ○ ○ ○" pool → { title, max, labels: [] }; a "Blaze:  nil ○○ 1d4 …" titled state track →
 *  { title, max, labels }; a bare state list ("○ youthful, ○ mature, ○ elderly") → { title: null, max,
 *  labels }. Shape matches the arcanum resource field. Returns null with no ○ pips or when the lead is
 *  prose (a lone consequence checkbox). Give it spanText() output so box dingbats don't pollute labels. */
export function parseResourceLine(text) {
	const max = (text.match(/○/g) || []).length;
	if (!max) return null;
	// Optional "Title:" prefix — a short, pip-free label ending in a colon (Charge:, Blaze:, hours:).
	let title = null, body = text;
	const m = body.match(/^\s*([A-Za-z][A-Za-z ()]{0,30}?)\s*:\s*(.*)$/s);
	if (m && !/○/.test(m[1])) { title = m[1].replace(/[()]/g, " ").replace(/\s+/g, " ").trim(); body = m[2]; }
	// State labels: ≥2 short comma-separated segments (pips stripped, digits kept for dice labels 1d4).
	const segs = body.replace(/[○◯◇□◻]/g, " ").split(",")
		.map((s) => s.replace(/[^A-Za-z0-9 /'+-]/g, " ").replace(/\s+/g, " ").trim())
		.filter(Boolean);
	const labels = (segs.length >= 2 && segs.every((s) => s.split(/\s+/).length <= 3)) ? segs : [];
	if (title) return { max, title, labels };
	if (labels.length) return { max, title: null, labels };
	// No title/labels: a short lead word before the pips is the pool title ("Ire  ○ ○ ○"); a long/absent
	// lead means a stray ○ in prose (a lone consequence checkbox, an embedded pip) — not a resource.
	const head = body.slice(0, body.indexOf("○")).replace(/[◇□◻○◯]/g, " ").replace(/[:,]\s*$/, "").replace(/\s+/g, " ").trim();
	if (head && /[A-Za-z]/.test(head) && head.split(/\s+/).length <= 4) return { max, title: head, labels: [] };
	return null;
}

/** An item def line can carry a trailing "Label:  ○ ○ ○" track fused onto its tags (the Moonstone's
 *  hours, the Flaming Sword's Blaze). Split that track onto item.resource and trim it out of the note. */
export function attachItemResource(item, lines) {
	const t = spanText(lines);
	if (!item || !/○/.test(t)) return item;
	const before = t.slice(0, t.indexOf("○"));
	// The "Label:" before the pips: prefer an Uppercase-started name (so a preceding lowercase note word
	// like "1 piercing Blaze:" yields "Blaze", not "piercing Blaze"), else fall back to a lowercase word ("hours:").
	const lm = before.match(/([A-Z][A-Za-z ]{0,20}):[^:]*$/) || before.match(/([A-Za-z]+):[^:]*$/);
	const r = parseResourceLine(lm ? t.slice(before.lastIndexOf(lm[1])) : t.slice(t.indexOf("○")));
	if (!r) return item;
	item.resource = r;
	if (r.title && item.note) { const i = item.note.indexOf(r.title); if (i >= 0) item.note = item.note.slice(0, i).replace(/[,\s]+$/, "").trim() || null; }
	return item;
}

/** A name-first outfit item: "<name> ( ○ ○ … <label>, Value N )" — the pips are a uses pool and
 *  "Value N" is the item's value note (Opening the Way's pouch of powdered cinnabar). Distinct from the
 *  ◇-tags item form. Give it spanText() output (○ pips intact). Returns the item def, or null. */
export function parseNameFirstItem(text) {
	const m = text.match(/^(.*?)\(\s*([○\s]*)([A-Za-z][A-Za-z ]*?)?\s*,?\s*Value\s*(\d+)\s*\)/);
	if (!m) return null;
	const name = m[1].replace(/\s+/g, " ").trim();
	// The uses pool is every ○ on the item's line(s) — extraction can strand a pip past the closing
	// paren ("… uses, Value 2) ○"), so count them all (the pouch's 4×3 grid reads 12, not 11), not just
	// the run captured before the "uses" label.
	const max = (text.match(/○/g) || []).length;
	if (!name || !max) return null;
	return { name, weight: 1, tags: null, note: `Value ${m[4]}`, inventoryColumn: "regular",
		resource: { max, title: (m[3] || "").trim() || null, labels: [] } };
}

/** Build the back side (the spell / mysteries) from its blocks. Stat blocks (followers) are handled
 *  by build-arcana via toFollowerDoc; here we collect moves/consequences/resource. */
export function parseBack(blocks, { slug, name, major, unlockAt } = {}) {
	if (major) return parseMajorBack(blocks, { slug, name, unlockAt });
	// A minor arcanum's back is the "spell": a title, an optional item tags line, and flowing
	// description — no named moves or consequence tracks (those are major-only, kept null/[] for shape).
	// A clean dice table is promoted to a RollTable (build-arcana writes the pack file) and referenced
	// inline via a player-rollable @DrawTableInline block (rows + roll button); the footer-strip false-positive tables don't qualify
	// and are dropped as card furniture.
	const back = { title: null, item: null, description: null, resource: null, moves: [], consequences: null, unlockAt: null };
	const rollTables = []; // transient RollTable specs; build-arcana emits the pack files, then strips this
	const parts = [];      // description fragments in reading order (paras, lists, table links interleaved)
	let resource = null;   // the first ○-pip track; attached to back.item.resource if a back item exists, else back.resource
	for (const b of blocks) {
		if (b.type === "heading" || b.type === "title") {
			const t = b.line.text.trim();
			if (!/^(front|back)$/i.test(t) && !/^appendix [cd]/i.test(t) && !back.title) back.title = t; // spell name
			continue;
		}
		if (b.type === "table") {
			const q = qualifyTable(b);
			if (q) {
				const id = deterministicId(TABLE_PACK, `${slug}#table-${rollTables.length}`);
				const label = (back.title ?? name ?? "Table") + (rollTables.length ? ` (${rollTables.length + 1})` : "");
				rollTables.push({ id, uuid: tableUuid(id), name: label, formula: q.formula, results: q.results });
				parts.push(`@DrawTableInline[${tableUuid(id)}]{${q.formula}}`);
			}
			continue;
		}
		if (b.type === "rule" || b.type === "boxstart" || b.type === "boxend" || b.type === "statblock" || b.type === "image") continue;
		if (b.type === "para") {
			const lines = [...b.lines];
			// A leading "Label:  ○ ○ ○" pool (or bare state list) at the top of a para → the back's track.
			if (!resource && lines.length && /○/.test(lines[0].text)) {
				const r = parseResourceLine(spanText([lines[0]]));
				if (r) { resource = r; lines.shift(); }
			}
			if (!lines.length) continue;
			const t = joinMd(lines);
			// A name-first outfit item ("<name> ( ○ … , Value N)") → the back item (Opening the Way's pouch).
			if (!back.item && !parts.length) { const nf = parseNameFirstItem(spanText(lines)); if (nf) { back.item = nf; continue; } }
			// A leading tags line right under the spell title → the back item (mirrors the front).
			if (!back.item && !parts.length && (b.tags || /^,/.test(t.replace(/^[◇○□◻\s]+/, "")))) {
				back.item = attachItemResource(parseItemLine(t, { name: back.title }), lines); continue;
			}
			parts.push(splitAssignRows(t));
			continue;
		}
		if (b.type === "list") {
			const bullets = [];
			for (const it of b.items) {
				const raw = it.map((l) => l.text).join(" "); // joinMd strips ○/◇ markers; detection needs the raw glyphs
				// A back item def line (◇ load + italic tags) as the first content → the back item (an outfit item),
				// possibly with a track fused onto its tags line (Moonstone's hours, the Flaming Sword's Blaze).
				if (!back.item && !parts.length && !bullets.length && /^,/.test(raw.replace(/^[◇○□◻\s]+/, ""))) {
					back.item = attachItemResource(parseItemLine(joinMd(it), { name: back.title }), it); continue;
				}
				// A ○-pip state-track line → the back's resource track.
				if (!resource && /○/.test(raw)) { const r = parseResourceLine(spanText(it)); if (r) { resource = r; continue; } }
				bullets.push(`- ${stripMarkers(joinMd(it))}`);
			}
			if (bullets.length) parts.push(bullets.join("\n"));
		}
	}
	// Attach the track: an outfit item on the back owns its own resource; otherwise it's a back-side pool.
	if (resource) { if (back.item) back.item.resource = resource; else back.resource = resource; }
	if (parts.length) back.description = parts.join("\n\n");
	if (rollTables.length) back.rollTables = rollTables;
	return back;
}
