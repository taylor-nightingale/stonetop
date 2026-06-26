// ── Chronicle compiler (pure core) ─────────────────────────────────────────────
// Turns the answers recorded during the guided Character Introductions (and the
// Spring Burst notes folded in) into structured pages for the shared "Chronicle".
// Kept free of Foundry globals so it's unit-testable; utils/chronicle.js wraps it
// to gather the world data and upsert the actual JournalEntry.
//
// Each page is { key, name, sections }, where every section is one of:
//   • prose — { kind:"prose", heading, group:"glance", body }   (rich HTML)
//   • qa    — { kind:"qa",    heading, group:"glance", pairs }   ([{prompt, answer}])
// This is the same shape the location page model (LocationPageModel) stores, so the
// Chronicle reuses that page sheet and its inline Q&A editor (Bonds & ties / Asked
// of the others become editable prompt/answer pairs, like a location's "In Play"
// questions). `group:"glance"` keeps the sheet from drawing act banners.

import { escHtml } from "./strings.js";
import { step4Questions, step6Questions } from "../dialogs/introductions-data.js";
import { CHART_GROUPS } from "../dialogs/expedition-data.js";
import { SEASONAL_GAINS } from "../dialogs/spring-burst-data.js";

// "The Chronicle" is a Journal FOLDER holding two journals — the player
// introductions and the expedition log. (Foundry folders hold entries, not pages, so
// grouping the record means splitting it across two entries.) PC + Spring Burst pages
// live in the introductions journal; expedition pages in the expeditions journal.
export const CHRONICLE_FOLDER_NAME = "The Chronicle";
export const CHRONICLE_FOLDER_COLOR = "#959BB8";
export const INTRODUCTIONS_JOURNAL_NAME = "Player Introductions";
export const EXPEDITIONS_JOURNAL_NAME = "Expeditions";
export const SPRING_PAGE_NAME = "Let Spring Burst Forth";

// Stable per-page key, stored on the page so re-saves match it (rather than matching
// by name, which breaks when a PC is renamed). The party Spring Burst page uses a
// fixed sentinel; PC pages use the actor id; expedition pages use this prefix plus
// the trip's id.
export const SPRING_PAGE_KEY = "__spring__";
export const EXPEDITION_PAGE_KEY_PREFIX = "expedition:";

// Sections all sit in the opening "act" so the page sheet draws no act banner.
const SECTION_GROUP = "glance";

// Escape user-entered text and turn blank-line-separated blocks into paragraphs,
// single newlines into <br>. Returns "" for blank input.
function paragraphs(text) {
	const trimmed = String(text ?? "").trim();
	if (!trimmed) return "";
	return trimmed
		.split(/\n{2,}/)
		.map(block => `<p>${escHtml(block).replace(/\n/g, "<br>")}</p>`)
		.join("");
}

// Decode the few HTML entities the authored question text carries (e.g. "heart
// &amp; soul"), so the stored qa prompt reads as plain text in its edit input.
// `&amp;` is decoded last so an `&amp;mdash;` source can't double-decode.
function decodeEntities(text) {
	return String(text ?? "")
		.replace(/&mdash;/g, "—")
		.replace(/&ndash;/g, "–")
		.replace(/&hellip;/g, "…")
		.replace(/&rsquo;/g, "’")
		.replace(/&lsquo;/g, "‘")
		.replace(/&quot;/g, '"')
		.replace(/&amp;/g, "&");
}

// A list-bearing prose body gets the location-body wrapper so its bullets render as
// spirals (matching the rest of this system's prose; see styles/stonetop.css
// `.stonetop-location-body`). Paragraph-only bodies are left untouched.
function withSpiralBullets(html) {
	return /<[uo]l[\s>]/i.test(html) ? `<div class="stonetop-location-body">${html}</div>` : html;
}

// A prose section, or null when there's no body to show.
function proseSection(heading, bodyHtml) {
	return bodyHtml ? { kind: "prose", heading, group: SECTION_GROUP, body: withSpiralBullets(bodyHtml) } : null;
}

// A Q&A section (prompt/answer pairs), or null when no pair has an answer.
function qaSection(heading, pairs) {
	return pairs.length ? { kind: "qa", heading, group: SECTION_GROUP, pairs } : null;
}

// Build the prompt/answer pairs for the answer/ask rounds (r4/r5 or r6/r7),
// resolving each record's stored question index back to its authored text. Records
// with no answer are dropped; a record with an answer but no chosen question keeps a
// blank prompt. The question strings are trusted authored text (entities decoded);
// answers are user text (the page sheet escapes them on display).
function qaPairsFrom(records, questions) {
	return (records ?? [])
		.map(rec => {
			const answer = String(rec?.a ?? "").trim();
			if (!answer) return null;
			const qIdx   = Number.isInteger(rec?.q) ? rec.q : null;
			const prompt = qIdx != null ? decodeEntities(questions?.[qIdx] ?? "") : "";
			return { prompt, answer };
		})
		.filter(Boolean);
}

// Render the ticked items of an expedition checklist (Chart a Course's requirements
// & challenges) as a per-group bulleted list — the journey's shape, in the GM's own
// words. `checks` is the saved { key: bool } map; item text is trusted authored HTML.
// Returns "" when nothing in any group is ticked.
function checkedGroups(groups, checks) {
	return (groups ?? [])
		.map(group => {
			const items = (group.items ?? []).filter(it => checks?.[it.key]);
			if (!items.length) return "";
			const lis = items.map(it => `<li>${it.text}</li>`).join("");
			return `<p><strong>${escHtml(group.label)}</strong></p><ul>${lis}</ul>`;
		})
		.filter(Boolean)
		.join("");
}

// Compile one logged expedition into a Chronicle page, or null when it holds nothing
// worth recording. The arriving-home checklist is GM prep (questions, not answers), so
// only its free-text "Return Triumphant?" note carries through.
function buildExpeditionPage(exp, index) {
	const chart = exp?.chart ?? {};
	const home  = exp?.home ?? {};
	const sections = [
		proseSection("Destination & route", paragraphs(chart.route)),
		proseSection("The way ahead", checkedGroups(CHART_GROUPS, chart.checks) + paragraphs(chart.notes)),
		proseSection("Outfit & supplies", paragraphs(exp?.outfit)),
		proseSection("Requisitioned", paragraphs(exp?.requisition)),
		proseSection("Other preparations", paragraphs(exp?.prep)),
		proseSection("The journey", paragraphs(exp?.running)),
		proseSection("Coming home", paragraphs(home.notes)),
	].filter(Boolean);
	if (!sections.length) return null;

	const title = String(exp?.title ?? "").trim();
	const name  = title ? `Expedition: ${title}` : `Expedition ${index + 1}`;
	return { key: `${EXPEDITION_PAGE_KEY_PREFIX}${exp.id}`, name, sections };
}

/**
 * Merge freshly-compiled sections into a page's existing sections, preserving the
 * existing ones (and any inline edits) and folding in only content recorded since the
 * page was first seeded: sections whose heading is new, and — for a matching Q&A
 * section — answer pairs not already present (matched on prompt+answer). Prose with a
 * heading that already exists is left untouched: once a page is seeded its prose is
 * edited in the journal, not regenerated. Lets a part-way / multi-session save fold the
 * later rounds (or later expedition-step notes) into an already-seeded page instead of
 * being silently dropped.
 *
 * @returns {{ sections: Array<object>, added: number }}  the merged section list and the
 *   number of new sections + new pairs (0 when nothing changed).
 */
export function mergeChronicleSections(existing = [], computed = []) {
	// Copy so the caller's stored array (and each Q&A section's pairs) isn't mutated.
	const merged    = (existing ?? []).map(s => ({ ...s, ...(s?.pairs ? { pairs: [...s.pairs] } : {}) }));
	const byHeading = new Map(merged.map(s => [s.heading, s]));
	let added = 0;
	for (const section of computed ?? []) {
		const match = byHeading.get(section.heading);
		if (!match) {
			merged.push(section);
			byHeading.set(section.heading, section);
			added += 1;
			continue;
		}
		// Same-heading Q&A: append pairs we don't already have, so a question answered in
		// a later round still lands. Dedupe on the (prompt, answer) tuple — JSON-encoded
		// so neither field can bleed across the boundary and cause a false match.
		if (match.kind === "qa" && section.kind === "qa") {
			match.pairs ??= [];
			const pairKey = p => JSON.stringify([p.prompt ?? "", p.answer ?? ""]);
			const have = new Set(match.pairs.map(pairKey));
			for (const pair of section.pairs ?? []) {
				const sig = pairKey(pair);
				if (!have.has(sig)) { match.pairs.push(pair); have.add(sig); added += 1; }
			}
		}
	}
	return { sections: merged, added };
}

/**
 * Build the Chronicle's pages from the recorded answers.
 *
 * @param {object}  opts
 * @param {Array<{id,name,playbookName,slug}>} opts.pcs  Player characters, in display order.
 * @param {object}  opts.introAnswers   `introductionsAnswers` blob, keyed by actor id.
 * @param {object}  opts.springAnswers  `springBurstAnswers` blob ({ gains, hook, excites }).
 * @param {Array<object>} opts.expeditions  The expedition log (`expeditionAnswers.list`),
 *   oldest first; each trip with content becomes its own page.
 * @returns {Array<{key,name,sections}>}  One page per PC with recorded content, then a
 *   party "Let Spring Burst Forth" page when there's Spring Burst content, then one
 *   page per logged expedition. Empty when nothing has been recorded.
 */
export function buildChroniclePages({ pcs = [], introAnswers = {}, springAnswers = {}, expeditions = [] } = {}) {
	const pages   = [];
	const excites = springAnswers?.excites ?? {};

	for (const pc of pcs) {
		const a     = introAnswers?.[pc.id] ?? {};
		const step4 = step4Questions(pc.slug) ?? [];
		const step6 = step6Questions(pc.slug) ?? [];

		const sections = [
			proseSection("Introduction", paragraphs(a.r1)),
			proseSection("Possessions & contribution", paragraphs(a.r2)),
			proseSection("Their place in Stonetop", paragraphs(a.r3)),
			qaSection("Bonds & ties", qaPairsFrom([a.r4, a.r5], step4)),
			qaSection("Asked of the others", qaPairsFrom([a.r6, a.r7], step6)),
			proseSection("What excites their player", paragraphs(excites[pc.id])),
		].filter(Boolean);

		// Skip PCs with nothing recorded yet — a page appears once they have content.
		if (!sections.length) continue;

		const name = pc.playbookName ? `${pc.name} — ${pc.playbookName}` : pc.name;
		pages.push({ key: pc.id, name, sections });
	}

	// Party-level Spring Burst page (the per-PC "what excites you" already folded
	// into each page above). The omen section names the ticked seasonal gain(s),
	// then the hook prose the GM noted. (Who's "most hopeful" is a table decision the
	// walkthrough no longer records, so there's no section for it.)
	const omenGains = SEASONAL_GAINS.filter(g => springAnswers?.gains?.[g.key]).map(g => g.name);
	const omenBody  =
		(omenGains.length ? `<p><strong>${omenGains.length > 1 ? "Gains" : "Gain"} chosen:</strong> ${omenGains.join(", ")}</p>` : "")
		+ paragraphs(springAnswers?.hook);
	const spring = [
		proseSection("The season's omen", omenBody),
	].filter(Boolean);
	if (spring.length) pages.push({ key: SPRING_PAGE_KEY, name: SPRING_PAGE_NAME, sections: spring });

	// One page per logged expedition, oldest first (a growing campaign log).
	(expeditions ?? []).forEach((exp, i) => {
		const page = buildExpeditionPage(exp, i);
		if (page) pages.push(page);
	});

	return pages;
}
