// Build the arcana pack source from Book II Appendix C (Minor) + D (Major).
//   node scripts/import/pdf/build-arcana.js            # report only -> helper/arcanum-manual-review.md
//   node scripts/import/pdf/build-arcana.js --write    # regenerate the 9 minor follower files
//   node scripts/import/pdf/build-arcana.js --write-arcana  # ALSO overwrite packs/src/arcana/major/*.json
//                                                            (minor fronts still WIP, left untouched)
//
// The book lays each arcanum out as a two-sided card: a FRONT (name, item, description, unlock) that
// ends with a "front" side-label, and a BACK (spell / mysteries) that ends with a "back" side-label.
// We split the flattened block stream on those labels, match fronts to arcana by name and backs by
// their existing `back.title` (we regenerate a known set), preserve each `_id`/`folder` by slug, and
// report divergences from the hand-authored JSON.
//
// The follower regeneration (--write) is finished + isolated: it rewrites only the minor follower
// items (matched to the existing roster by name) and their icons; the existing arcana backs already
// wire the followers, so it touches no arcanum JSON. The front/back parser still diverges widely
// (see the review report — ~29 backs unparsed, unlock rows off), so the arcanum overwrite is held
// behind the separate --write-arcana flag until that parser is finished.
import os from "os"; import path from "path";
import { mkdtempSync, rmSync, readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "fs";
import { createHash } from "crypto";
import { execFileSync } from "child_process";
import { loadOutline, arcanaAppendixRanges } from "./outline.js";
import { loadArticlePages } from "./load.js";
import { extractArticle } from "./layout.js";
import { parseFront, parseBack, isArcanaFollower, matchFollowerIcons, parseMoveRoll, resourceTracks, frontMoveResources, followerChoices, followerChoiceEntry, isFollowerGroup, foldBackChoices, numberBlanks } from "./arcana-parse.js";
import { parseStatBlock, toFollowerDoc } from "./creatures.js";
import { markerImg, NPC_DEFAULT_IMG } from "./markers.js";
import { gridCards } from "./minor-arcana-grid.js";
import { applyArcanaEdits } from "./manual-edits.js";
import { toRollTableDoc, TABLE_PACK } from "./tables.js";
import { toSlug } from "../../../src/utils/slug.js";

const PDF = process.env.BOOK_PDF ?? "helper/Book_II_-_The_Wider_World_and_Other_Wonders.pdf";
const WRITE_ARCANA = process.argv.includes("--write-arcana"); // overwrite major arcanum JSON (parser WIP)
const WRITE_MINOR = process.argv.includes("--write-minor");   // regenerate every minor arcanum from the card grid
const WRITE = process.argv.includes("--write") || WRITE_ARCANA; // regenerate follower files + icons
const REVIEW = "helper/arcanum-manual-review.md";
const norm = (s) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
// A looser key that drops the connective words a/an/the/of, so a back heading like "Mysteries of
// Noruba's Ice Sphere" still matches the hand-authored "Mysteries of the Noruba's Ice Sphere".
const normLoose = (s) => norm((s ?? "").toLowerCase().replace(/\b(?:the|of|a|an)\b/g, " "));
const totalPages = () => Number((execFileSync("mutool", ["info", PDF], { encoding: "utf8" }).match(/Pages:\s*(\d+)/) || [])[1] || 302);
const lineText = (b) => b.type === "heading" || b.type === "title" ? b.line.text : (b.lines?.[0]?.text ?? "");
const isLabel = (b, re) => (b.type === "heading" || b.type === "title") && re.test(b.line.text.trim());

// Major-arcana mystery moves are real `move` items, owned by the arcanum via `back.moveSlugs` (the
// container-owned moves model — moves carry no `moveType`/back-reference). Promote a parsed back's
// inline `moves` into standalone move pack files and replace them with `moveSlugs`. No-op if the back
// already uses `moveSlugs` (e.g. a preserved hand-authored back). Move `_id` is derived from the slug
// so re-runs are stable.
const ARCANA_MOVES_DIR = "packs/src/moves/arcana";
const ARCANA_MOVES_FOLDER = "ArcanaMoves00001"; // packs/src/moves/_folders/arcana.json
const arcanaMoveId = (slug) => createHash("sha1").update("arcana-move:" + slug).digest("hex").slice(0, 16);

// Write one arcana move pack file from a parsed inline move ({id, name, text, requirement?}). Rollable
// text ("roll +X") gets its stat + 10+/7-9/6- tiers (bug #43); a matched ○ resource track (back moves'
// far-right pips, or a front move's Casting penalty) becomes the move's resource, with `hasBlank` → a
// write-in input (bug #41). Shared by back moves and the front move.
function writeArcanaMove(m, resourceBySlug) {
	mkdirSync(ARCANA_MOVES_DIR, { recursive: true });
	const slug = m.id;
	const id = arcanaMoveId(slug);
	const { rollStat, moveResults } = parseMoveRoll(m.text ?? "");
	const rt = resourceBySlug.get(slug);
	const resource = rt ? { max: rt.max, title: rt.title ?? null, ...(rt.hasBlank ? { input: { type: "inline" } } : {}) } : null;
	const doc = { _id: id, _key: `!items!${id}`, name: m.name, type: "move",
		system: { slug, moveType: null, description: m.text ?? "",
			...(rollStat ? { rollStat } : {}), ...(moveResults ? { moveResults } : {}),
			...(resource ? { resource } : {}),
			...(m.requirement ? { requirement: m.requirement } : {}) }, folder: ARCANA_MOVES_FOLDER };
	writeFileSync(path.join(ARCANA_MOVES_DIR, `${slug}.json`), JSON.stringify(doc, null, "\t") + "\n");
	return slug;
}

function emitArcanaMoves(back, resourceBySlug = new Map()) {
	if (!back || !Array.isArray(back.moves)) return back;
	const slugs = back.moves.map((m) => writeArcanaMove(m, resourceBySlug));
	const out = {};
	for (const [k, v] of Object.entries(back)) { if (k === "moves") out.moveSlugs = slugs; else out[k] = v; }
	return out;
}

// A front-granted move (the Codex's CAST A CODEX SPELL) rides on `front._frontMove`; write its move file
// and strip the transient field (the move-grant unlock entry is already in place from parseFront).
function emitFrontMove(front, resourceBySlug = new Map()) {
	if (!front?._frontMove) return front;
	writeArcanaMove(front._frontMove, resourceBySlug);
	const out = {}; for (const [k, v] of Object.entries(front)) { if (k !== "_frontMove") out[k] = v; }
	return out;
}

// parseFront hangs transient staging fields on the front for the emitters above (`_frontMove`,
// `_frontFollower`). None of them belong in pack data whether or not their emitter ran (minor fronts run
// neither), so every write goes through here — one gate, rather than each emitter being trusted to clean up.
function stripTransient(side) {
	const out = {};
	for (const [k, v] of Object.entries(side ?? {})) if (!k.startsWith("_")) out[k] = v;
	return out;
}

// The parser reproduces the book faithfully, typos and all; ARCANA_EDITS carries the per-arcanum
// corrections. Every write goes through here, and an edit that matches nothing is collected for the
// review (so a correction that quietly stops applying surfaces instead of vanishing).
const editMisses = [];
function edited(system, slug) {
	const { system: out, misses } = applyArcanaEdits(system, slug);
	for (const m of misses) editMisses.push(`- \`${slug}\`: ${m}`);
	return out;
}

// Index existing arcana: slug -> record; name -> rec; backTitle -> rec.
const bySlug = new Map(), byName = new Map(), byBackTitle = new Map();
for (const tier of ["minor", "major"]) {
	for (const f of readdirSync(`packs/src/arcana/${tier}`).filter((n) => n.endsWith(".json"))) {
		const doc = JSON.parse(readFileSync(`packs/src/arcana/${tier}/${f}`, "utf8"));
		const rec = { slug: doc.system.slug, tier, doc, file: `packs/src/arcana/${tier}/${f}` };
		bySlug.set(rec.slug, rec);
		byName.set(norm(doc.name), rec);
		if (doc.system.back?.title) { byBackTitle.set(norm(doc.system.back.title), rec); byBackTitle.set(normLoose(doc.system.back.title), rec); }
	}
}

// Match a heading (possibly wrapped across 1–2 following blocks) against a name→record map, trying the
// exact norm and the looser (a/an/the/of-dropped) key (byBackTitle is indexed under both).
function matchHeading(blocks, i, map) {
	const b = blocks[i];
	if (b.type !== "heading" && b.type !== "title") return null;
	let raw = lineText(b);
	for (let k = 0; k <= 2; k++) {
		if (map.has(norm(raw))) return map.get(norm(raw));
		if (map.has(normLoose(raw))) return map.get(normLoose(raw));
		raw += " " + lineText(blocks[i + 1 + k] || {});
	}
	return null;
}

// Segment a block stream into per-record chunks anchored on headings that match `map`, each bounded
// to the side-label `endRe` (so a chunk stops at its "front"/"back" label and trailing neighbour
// content from another column is excluded). Returns [{ rec, blocks }].
function segmentBy(blocks, map, endRe) {
	const out = []; let cur = null;
	for (let i = 0; i < blocks.length; i++) {
		const rec = matchHeading(blocks, i, map);
		if (rec && (!cur || cur.rec.slug !== rec.slug)) { if (cur) out.push(cur); cur = { rec, blocks: [], done: false }; }
		if (!cur || cur.done) continue;
		cur.blocks.push(blocks[i]);
		if (isLabel(blocks[i], endRe)) cur.done = true;
	}
	if (cur) out.push(cur);
	return out;
}

// A major card's back is the block span BETWEEN its "front" and "back" side-labels (the physical back
// of the card). Anchoring on the arcanum NAME (every card has one) is robust; the "Mysteries of X"
// title heading is not — it may sit before Moves, after Consequences, or be absent entirely (staff /
// ineffable / redwood have none), so byBackTitle misses those backs or segments an empty tail.
function segmentMajorBacks(blocks, map) {
	const out = []; let rec = null, cur = null;
	for (let i = 0; i < blocks.length; i++) {
		const hit = matchHeading(blocks, i, map);
		if (hit && (!rec || rec.slug !== hit.slug)) { rec = hit; cur = null; }
		if (!rec) continue;
		if (isLabel(blocks[i], /^front$/i)) { cur = { rec, blocks: [] }; continue; } // back starts after the front label
		if (isLabel(blocks[i], /^back$/i)) { if (cur) { out.push(cur); cur = null; } continue; }
		if (cur) cur.blocks.push(blocks[i]);
	}
	if (cur) out.push(cur); // a final card with no trailing back label
	return out;
}

// ── divergence ──────────────────────────────────────────────────────────────
const txt = (s) => String(s ?? "").toLowerCase().replace(/[*_`#]/g, "").replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/…/g, "...").replace(/\s+/g, " ").trim();
const sim = (a, b) => { a = txt(a); b = txt(b); if (!a && !b) return 1; if (!a || !b) return 0; const A = new Set(a.split(" ")), B = new Set(b.split(" ")); let n = 0; for (const w of A) if (B.has(w)) n++; return (2 * n) / (A.size + B.size); };
const rows = (g) => g?.list?.length ?? 0;
const tracks = (g) => (g?.list || []).map((r) => r.track?.max ?? 0).join(",");

function diverge(parsed, doc) {
	const fl = [], ef = doc.system.front || {}, pf = parsed.front || {}, eb = doc.system.back || {}, pb = parsed.back || {};
	if (rows(pf.unlock) !== rows(ef.unlock)) fl.push(`front.unlock rows ${rows(pf.unlock)} vs ${rows(ef.unlock)}`);
	if (tracks(pf.unlock) !== tracks(ef.unlock)) fl.push(`front.unlock tracks [${tracks(pf.unlock)}] vs [${tracks(ef.unlock)}]`);
	if (sim(pf.description, ef.description) < 0.6) fl.push(`front.description low sim (${sim(pf.description, ef.description).toFixed(2)})`);
	if ((pf.item ? 1 : 0) !== (ef.item ? 1 : 0)) fl.push(`front.item ${!!pf.item} vs ${!!ef.item}`);
	if (!!parsed.back !== !!doc.system.back) fl.push(`back present ${!!parsed.back} vs ${!!doc.system.back}`);
	if (doc.system.back) {
		// Backs reference moves by slug (`back.moveSlugs`); the parsed back still carries inline moves
		// whose `.id` IS the slug, so compare slug-to-slug. Fall back to legacy inline `eb.moves`.
		const pbSlugs = (pb.moves || []).map((m) => m.id);
		const ebSlugs = eb.moveSlugs ?? (eb.moves || []).map((m) => m.id ?? m.name);
		if (sim(pb.title, eb.title) < 0.6) fl.push(`back.title "${pb.title}" vs "${eb.title}"`);
		if (pbSlugs.length !== ebSlugs.length) fl.push(`back.moves ${pbSlugs.length} vs ${ebSlugs.length}`);
		if (rows(pb.consequences) !== rows(eb.consequences)) fl.push(`back.consequences ${rows(pb.consequences)} vs ${rows(eb.consequences)}`);
		if (parsed.major) {
			if (pbSlugs.join("|") !== ebSlugs.join("|")) fl.push(`back.move slugs [${pbSlugs.join("|")}] vs [${ebSlugs.join("|")}]`);
			if (tracks(pb.consequences) !== tracks(eb.consequences)) fl.push(`back.consequence tracks [${tracks(pb.consequences)}] vs [${tracks(eb.consequences)}]`);
		}
	}
	return fl;
}

// ── run ───────────────────────────────────────────────────────────────────────
const FOLLOWER_DIR = "packs/src/followers/arcana";
const ARCANA_FOLLOWER_FOLDER = "BNaYX2Y4eMe7EOPK"; // packs/src/followers/_folders/arcana.json (every arcana follower lives here)

// Existing follower roster — authoritative for slug/_id/arcanaSlug (segmentation can misattribute a
// stat block, and canonical slugs drop a leading "The"). Minor followers are regenerated from the PDF
// (matched by normalized name); the 3 major followers are inlined + hand-authored, so preserved.
const followerRoster = new Map(); // normName -> { slug, name, arcanaSlug, id, key, folder, minor }
if (existsSync(FOLLOWER_DIR)) for (const f of readdirSync(FOLLOWER_DIR).filter((n) => n.endsWith(".json"))) {
	const d = JSON.parse(readFileSync(path.join(FOLLOWER_DIR, f), "utf8"));
	const arcanaSlug = d.system?.arcanaSlug ?? null;
	// The filename is the canonical slug (it matches the arcana back-ref and can drop a leading "The"
	// that toSlug(name) would keep).
	followerRoster.set(norm(d.name), { slug: f.replace(/\.json$/, ""), name: d.name, arcanaSlug,
		id: d._id, key: d._key, folder: d.folder, minor: bySlug.get(arcanaSlug)?.tier === "minor" });
}

const ranges = arcanaAppendixRanges(loadOutline(PDF), totalPages());
const parsedFront = new Map(); // slug -> front
const parsedBack = new Map();  // slug -> back
const resourceBySlug = new Map(); // move slug -> { max, hasBlank } (right-aligned ○ resource tracks)
const parsedByName = new Map(); // normName -> { creature, staged }  (parsed follower stat blocks)
const majorFollowerIcon = new Map(); // follower slug -> staged icon path (marker beside a major follower's name heading)
const review = [`# Arcanum parse — manual review`, ``];

const iconStage = mkdtempSync(path.join(os.tmpdir(), "arc-icons-"));
for (const range of ranges) {
	// Only the minor appendix lays followers out as clean stat blocks.
	const isMinor = /minor/i.test(range.title);
	const tmp = mkdtempSync(path.join(os.tmpdir(), "arc-"));
	const { pages, pageRules, pageImages } = loadArticlePages(PDF, range, { imgDir: tmp, imgPrefix: "arc" });
	const art = extractArticle(pages, { title: range.title, pageRules, pageImages });
	const blocks = [];
	for (const s of art.sections) for (const c of [...s.left, ...s.right]) blocks.push(...c.blocks);

	// Move resource tracks read straight off each page's raw markers (the column split strands them, so
	// they never survive into `blocks`). Move slugs are unique book-wide, so a flat slug→track map is safe.
	// Back moves' pips sit in the far-right column (resourceTracks); a FRONT move's pips sit mid-left,
	// keyed off its bold ALL-CAPS header (frontMoveResources — the Codex's Casting penalty).
	for (const p of pages) {
		for (const t of resourceTracks(p.lines)) resourceBySlug.set(t.slug, t);
		for (const t of frontMoveResources(p.lines)) resourceBySlug.set(t.slug, t);
	}

	// Fronts: anchored on arcanum names, bounded at the "front" label.
	for (const { rec, blocks: bl } of segmentBy(blocks, byName, /^front$/i))
		if (!parsedFront.has(rec.slug)) {
			parsedFront.set(rec.slug, parseFront(bl, { name: rec.doc.name, slug: rec.slug, major: rec.tier === "major" }));
		}
	// Backs: majors are segmented by the front→back label span (robust to a missing/mis-placed
	// "Mysteries of X" title); minors still anchor on the existing back.title, bounded at "back".
	const backSegs = isMinor ? segmentBy(blocks, byBackTitle, /^back$/i) : segmentMajorBacks(blocks, byName);
	for (const { rec, blocks: bl } of backSegs)
		if (!parsedBack.has(rec.slug)) parsedBack.set(rec.slug, parseBack(bl, { slug: rec.slug, name: rec.doc.name, major: rec.tier === "major" }));

	// Follower stat blocks (matched to the roster by name later). Copy each icon out of the per-range
	// tmp into the staging dir before it's removed.
	if (isMinor) for (const b of blocks) {
		if (b.type !== "statblock" || !isArcanaFollower(b)) continue;
		const creature = parseStatBlock(b.lines);
		if (!creature.name) continue;
		const key = norm(creature.name);
		if (parsedByName.has(key)) continue;
		let staged = null;
		if (b.icon?.file) { staged = path.join(iconStage, `${key}.png`); copyFileSync(b.icon.file, staged); }
		parsedByName.set(key, { creature, staged });
	}
	// A major follower's stat block isn't recognized by the layout parser (the back-side Astor/Halix on
	// the Blackwood back, the Mighty Servant on the Mindgem back; the front-side Ring on Daagon), so the
	// loop above never sees its icon. Its ~18px marker sits right beside its name heading — scan each
	// major page for a marker adjacent to a major follower's name and stage it, consumed below by
	// emitFrontFollower (front-resident) and the back-follower icon patch (preserved backs).
	if (!isMinor) {
		const majorNames = [...followerRoster.values()].filter((r) => !r.minor).map((r) => r.name);
		for (let i = 0; i < pages.length; i++)
			for (const { name, iconFile } of matchFollowerIcons(pages[i].lines, pageImages[i], majorNames)) {
				const r = followerRoster.get(norm(name));
				if (!r || majorFollowerIcon.has(r.slug)) continue;
				const staged = path.join(iconStage, `major-${r.slug}.png`);
				copyFileSync(iconFile, staged);
				majorFollowerIcon.set(r.slug, staged);
			}
	}
	rmSync(tmp, { recursive: true, force: true });
}

// Match parsed stat blocks to the roster, regenerate the minor follower files, and collect the
// arcanum→follower wiring used by the arcana write loop below. The follower icon references its
// arcanum's existing marker file (deduped) — or the npc default when it isn't a known marker.
let followersWritten = 0, followersMatched = 0;
const followerLines = [];
for (const r of followerRoster.values()) {
	if (!r.minor) continue; // majors preserved (inlined, hand-authored)
	const hit = parsedByName.get(norm(r.name));
	if (!hit) { followerLines.push(`- \`${r.slug}\` ← ${r.arcanaSlug}  (NO STAT BLOCK FOUND)`); continue; }
	followersMatched++;
	const marker = markerImg(hit.staged);
	const img = marker || NPC_DEFAULT_IMG;
	const doc = toFollowerDoc(hit.creature, { slug: r.slug, arcanaSlug: r.arcanaSlug, id: r.id, key: r.key, img, folder: r.folder });
	if (WRITE) { writeFileSync(path.join(FOLLOWER_DIR, `${r.slug}.json`), JSON.stringify(doc, null, "\t") + "\n"); followersWritten++; }
	followerLines.push(`- \`${r.slug}\` ← ${r.arcanaSlug}  (img: ${img.split("/").pop()})`);
}
const preserved = [...followerRoster.values()].filter((r) => !r.minor).map((r) => r.slug);

// The roster, reversed: arcanaSlug -> [followerSlug]. Every arcanum's follower group is DERIVED from
// this (minor and major alike) rather than carried over from the committed doc — a follower that named
// its arcanum but was never granted by it (the Demonhide Cloak's the-cloak) could not be repaired by a
// regen while the group was only ever preserved.
const followersByArcana = new Map();
for (const r of followerRoster.values()) {
	if (!r.arcanaSlug) continue;
	(followersByArcana.get(r.arcanaSlug) ?? followersByArcana.set(r.arcanaSlug, []).get(r.arcanaSlug)).push(r.slug);
}

// A card that prints its follower on the FRONT (the Ring of Daagon: "The ring itself becomes a
// follower") has no back choice group to inline it. Parse the split-off stat block into a follower
// doc, write it, and append a card-resident follower row (hidden from the followers tab) to the
// front's unlock group — the major-back `followerChoices` treatment, on the front. Mutates `front`
// (drops the internal `_frontFollower`) so the arcanum written below carries the wired entry.
const frontFollowerLines = [];
const frontEmittedSlugs = new Set(); // major followers written via the FRONT path (excluded from the back-follower icon patch)
function emitFrontFollower(rec, front) {
	const ff = front._frontFollower;
	delete front._frontFollower;
	if (!ff) return;
	const creature = parseStatBlock(ff.lines);
	if (!creature.name) return;
	// The follower's identity (slug/_id/folder) comes from the existing roster entry when present, so a
	// re-run preserves it; otherwise it's derived (slug drops a leading "The", e.g. "the-ring").
	const rosterEntry = followerRoster.get(norm(creature.name));
	const slug = rosterEntry?.slug ?? toSlug(creature.name);
	const img = markerImg(majorFollowerIcon.get(slug)) || NPC_DEFAULT_IMG; // the marker beside the follower's front-side name heading
	const doc = toFollowerDoc(creature, { slug, arcanaSlug: rec.slug, id: rosterEntry?.id, key: rosterEntry?.key, img, folder: rosterEntry?.folder ?? ARCANA_FOLLOWER_FOLDER });
	if (WRITE) { writeFileSync(path.join(FOLLOWER_DIR, `${slug}.json`), JSON.stringify(doc, null, "\t") + "\n"); }
	frontEmittedSlugs.add(slug);
	// FRONT-resident: the arcanum grants it owned-by-default (no checkbox), stamped off the followers tab.
	// parseFront already folded the front into one choices group — append the follower entry to it.
	const group = (front.choices ??= [{ slug: rec.slug, list: [] }])[0];
	group.list.push(followerChoiceEntry(slug, { hideFromFollowersTab: true, owned: true }));
	frontFollowerLines.push(`- \`${slug}\` ← ${rec.slug}  (FRONT-resident, kind=${doc.system.kind ?? "creature"}, img: ${img.split("/").pop()})`);
}

const reviewBody = [];
let parsedCount = 0, flagged = 0;
for (const rec of bySlug.values()) {
	const front = parsedFront.get(rec.slug);
	if (!front) continue;
	if (rec.tier === "major") emitFrontFollower(rec, front); // append the card-resident follower row before diverging/writing (reads the staged icon)
	parsedCount++;
	const parsed = { major: rec.tier === "major", front, back: parsedBack.get(rec.slug) ?? null };
	const fl = diverge(parsed, rec.doc);
	if (fl.length) { flagged++; reviewBody.push(`## ${rec.doc.name} \`${rec.slug}\` (${rec.tier})`, ...fl.map((f) => `- ${f}`), ``); }

	// --write-arcana overwrites MAJOR arcana only (front + back); minor fronts are still divergent
	// (WIP), so they're left untouched (their hand-authored follower wiring stays intact).
	if (WRITE_ARCANA && rec.tier === "major") {
		// The parser is now authoritative for every major back (front→back span segmentation handles the
		// cards that used to come up empty), so no hand-authored back fallback.
		let back = parsed.back;
		// Inline the card's follower(s) from the roster, the same way minors do. A follower already
		// emitted on the FRONT (the Ring itself) is excluded — it has its own card-resident row there and
		// must not appear twice. The committed group is the fallback, for a follower group that was
		// hand-authored without a roster entry to derive it from.
		const existing = rec.doc.system.back?.choices;
		const existingGroups = Array.isArray(existing) ? existing : (existing ? [existing] : []);
		const backFollowers = (followersByArcana.get(rec.slug) ?? []).filter((s) => !frontEmittedSlugs.has(s));
		const followerGroup = followerChoices(rec.slug, backFollowers) ?? existingGroups.find(isFollowerGroup) ?? null;
		// Promote parsed inline moves → move pack files + `back.moveSlugs`, then fold every back section
		// (spells / moves / followers / consequences) into the ordered `back.choices` array of groups.
		back = foldBackChoices(emitArcanaMoves(back, resourceBySlug), followerGroup);
		// A front-granted move (the Codex's CAST A CODEX SPELL) → its move pack file; strips `_frontMove`.
		const outFront = stripTransient(emitFrontMove(front, resourceBySlug));
		const sys = edited({ slug: rec.slug, front: outFront, back, major: true }, rec.slug);
		const out = { _id: rec.doc._id, _key: rec.doc._key, name: rec.doc.name, type: "arcanum",
			...(rec.doc.img ? { img: rec.doc.img } : {}), system: sys, flags: {}, folder: rec.doc.folder };
		writeFileSync(rec.file, JSON.stringify(out, null, "\t") + "\n");
	}
}
// Stamp each back-side major follower's parsed marker onto its preserved (hand-authored) doc. Only the
// `img` field changes; the inlined-choice-group body stays exactly as authored. Front-resident majors
// (the Ring) already get their icon via emitFrontFollower, so they're excluded. Runs before iconStage
// is cleaned up (markerImg reads the staged file).
const majorIconLines = [];
for (const r of followerRoster.values()) {
	if (r.minor || frontEmittedSlugs.has(r.slug)) continue;
	const img = markerImg(majorFollowerIcon.get(r.slug));
	if (!img) { majorIconLines.push(`- \`${r.slug}\` ← ${r.arcanaSlug}  (NO MARKER ICON FOUND)`); continue; }
	const file = path.join(FOLLOWER_DIR, `${r.slug}.json`);
	const doc = JSON.parse(readFileSync(file, "utf8"));
	const changed = doc.img !== img;
	if (changed && WRITE) { doc.img = img; writeFileSync(file, JSON.stringify(doc, null, "\t") + "\n"); }
	majorIconLines.push(`- \`${r.slug}\` ← ${r.arcanaSlug}  (img: ${img.split("/").pop()}${changed ? "" : ", unchanged"})`);
}

rmSync(iconStage, { recursive: true, force: true }); // after the review loop — emitFrontFollower reads staged icons

// ── minor arcana: regenerate every card from the geometric grid parser ──────────
// The minor appendix is a card grid the column pipeline can't segment (see minor-arcana-grid.js);
// parse it geometrically and overwrite each minor arcanum's front + back, preserving its identity
// (_id/_key/slug/folder). Back dice tables become wonder-tables RollTables (arcana- prefix so
// build-tables leaves them) referenced inline by a player-rollable @DrawTable link.
let minorWritten = 0, minorTables = 0; const minorUnmatched = [], minorEmptyFronts = [], resItemReview = [];
// Backs whose item is implied by the front, not printed (manual pass — see the loop below).
const BACK_ITEM_FROM_FRONT = new Set(["redwood-basin"]);
if (WRITE_MINOR) {
	const minorRange = ranges.find((r) => r.tier === "minor");
	const TABLE_OUT = `packs/src/${TABLE_PACK}`;
	mkdirSync(TABLE_OUT, { recursive: true });
	for (const f of readdirSync(TABLE_OUT).filter((n) => n.startsWith("arcana-"))) rmSync(path.join(TABLE_OUT, f));
	const gtmp = mkdtempSync(path.join(os.tmpdir(), "arc-grid-"));
	const { pages, pageRules, pageImages } = loadArticlePages(PDF, minorRange, { imgDir: gtmp, imgPrefix: "minor" });
	const cards = [];
	pages.forEach((pg, i) => { for (const c of gridCards(pg, { rules: pageRules[i], images: pageImages[i] })) cards.push(c); });
	rmSync(gtmp, { recursive: true, force: true });
	for (const card of cards) {
		const rec = byName.get(norm(card.frontTitle)) ?? byBackTitle.get(norm(card.backTitle));
		if (!rec || rec.tier !== "minor") { minorUnmatched.push(`${card.number}:${card.frontTitle}`); continue; }
		const front = parseFront(card.frontBlocks, { name: rec.doc.name, slug: rec.slug });
		let back = parseBack(card.backBlocks, { name: card.backTitle, slug: rec.slug, major: false });
		const followerGroup = followerChoices(rec.slug, followersByArcana.get(rec.slug)); // inline follower(s), major-style
		// Manual pass: a few backs don't print their own item — it's implied by the front (e.g. the
		// redwood basin IS the bittersweet elixir's vessel). Copy the front item onto the back side.
		if (BACK_ITEM_FROM_FRONT.has(rec.slug) && front.item && !back.item) back.item = structuredClone(front.item);
		if (back.item || back.resource) resItemReview.push(
			`- \`${rec.slug}\`${back.item ? ` item="${back.item.name}"${back.item.resource ? ` +resource=${JSON.stringify(back.item.resource)}` : ""}` : ""}${back.resource ? ` back.resource=${JSON.stringify(back.resource)}` : ""}`);
		(back.rollTables ?? []).forEach((rt, i) => {
			writeFileSync(path.join(TABLE_OUT, `arcana-${rec.slug}-${i}.json`), JSON.stringify(toRollTableDoc({ rollTable: rt }, { sort: 9000 + minorTables }), null, 2) + "\n");
			minorTables++;
		});
		delete back.rollTables;
		back = foldBackChoices(back, followerGroup); // minors have only a follower group (no moves/consequences) → [intro?, followers?]
		const system = edited({ slug: rec.slug, front: stripTransient(front), back }, rec.slug);
		// A front with no content is always a parse failure — every card prints a description — and it
		// used to ship silently (`diverge` compares against the doc we're about to overwrite, so an empty
		// front matching an already-empty front looked clean).
		if (!(system.front.choices ?? []).length) minorEmptyFronts.push(`${card.number}:${rec.slug}`);
		const doc = { _id: rec.doc._id, _key: rec.doc._key, name: rec.doc.name, type: "arcanum",
			...(rec.doc.img ? { img: rec.doc.img } : {}), system, flags: {}, folder: rec.doc.folder };
		writeFileSync(rec.file, JSON.stringify(doc, null, "\t") + "\n");
		minorWritten++;
	}
}

// Number write-in blanks (____ runs) into stable `@Blank[n]` tokens across every arcanum on disk — the
// enricher renders each as an editable field. Idempotent, so it's safe to run over freshly-written
// minors and already-committed majors alike whenever we regenerate any tier.
let blanksNumbered = 0;
if (WRITE_MINOR || WRITE_ARCANA) {
	for (const tier of ["major", "minor"]) {
		const dir = `packs/src/arcana/${tier}`;
		for (const f of readdirSync(dir).filter((n) => n.endsWith(".json"))) {
			const file = path.join(dir, f);
			const doc = JSON.parse(readFileSync(file, "utf8"));
			const n = numberBlanks(doc.system);
			if (n) { writeFileSync(file, JSON.stringify(doc, null, "\t") + "\n"); blanksNumbered += n; }
		}
	}
}

const missing = [...bySlug.keys()].filter((s) => !parsedFront.has(s));
review.push(`Parsed ${parsedCount}/${bySlug.size} fronts, ${parsedBack.size} backs; ${flagged} flagged${missing.length ? `; NO FRONT: ${missing.join(", ")}` : ""}.`, ``);
if (minorEmptyFronts.length) review.push(`## EMPTY FRONTS (${minorEmptyFronts.length}) — parse failure, card number:slug`, ...minorEmptyFronts.map((s) => `- ${s}`), ``);
if (editMisses.length) review.push(`## Manual edits that matched nothing (${editMisses.length})`, ...editMisses, ``);
if (resItemReview.length) review.push(`## Back items & resource tracks (${resItemReview.length}) — verify vs book`, ...resItemReview.sort(), ``);
review.push(`## Followers`, `Matched ${followersMatched} minor follower(s) to stat blocks:`, ...followerLines,
	``, `Preserved hand-authored (major appendix, inlined format — not regenerated): ${preserved.length ? preserved.map((s) => `\`${s}\``).join(", ") : "none"}`, ``);
if (frontFollowerLines.length) review.push(`### Front-resident followers (regenerated from the card front)`, ...frontFollowerLines, ``);
if (majorIconLines.length) review.push(`### Back-side major follower icons (marker stamped onto the preserved doc)`, ...majorIconLines, ``);
review.push(...reviewBody);
mkdirSync(path.dirname(REVIEW), { recursive: true });
writeFileSync(REVIEW, review.join("\n"));
const mode = [WRITE_ARCANA && "major arcana JSON", WRITE_MINOR && "minor arcana JSON", WRITE && "followers"].filter(Boolean);
console.log(`fronts ${parsedCount}/${bySlug.size}, backs ${parsedBack.size}; ${flagged} flagged${missing.length ? `; ${missing.length} missing front` : ""}. followers ${followersMatched} matched${WRITE ? `, ${followersWritten} written` : ""}, ${preserved.length} preserved. -> ${REVIEW}  (${mode.length ? "WROTE " + mode.join(" + ") : "report only"})`);
if (WRITE_MINOR) console.log(`minor arcana: wrote ${minorWritten} doc(s) + ${minorTables} RollTable(s)${minorUnmatched.length ? `; UNMATCHED: ${minorUnmatched.join(", ")}` : ""}${minorEmptyFronts.length ? `; EMPTY FRONT: ${minorEmptyFronts.join(", ")}` : ""}`);
if (editMisses.length) console.log(`manual edits: ${editMisses.length} matched nothing -> ${REVIEW}`);
if (WRITE_MINOR || WRITE_ARCANA) console.log(`blanks: numbered ${blanksNumbered} write-in field(s) into @Blank[n] tokens`);
