// Lifting an improvement's SEASONAL clauses out of its effect prose.
//
// Pure and dependency-free so it can be tested against the real pack sources; the script that walks
// the folders and writes the field is build-seasonal-clauses.js beside it.
//
// The whole job is telling two things apart that both name a season:
//
//   * an ongoing effect — "Henceforth, when winter grips the land, the steading consumes 1 less
//     Surplus", which fires every winter forever and belongs on the turnover checklist;
//   * a REQUIREMENT or a piece of flavour — "Retrieve an acorn from the Golden Oak in late autumn",
//     "Large herds form on the Flats in spring", which happen once (or never) and do not.
//
// A keyword sweep cannot tell them apart and lands on the wrong six. The discriminator is WHERE the
// phrase sits: requirement rows are exactly the rows carrying a `track`, so the effect region is
// what follows the last of them.

import { Seasons } from "../../src/model/data/steading/Seasons.js";

const ALL = Seasons.all().map(s => s.key);

// The phrase that opens an improvement's effect region when it is embedded mid-row rather than
// given a row of its own (see effectRegion).
const EFFECT_MARKER = /(?:when you\s+)?\**_*(?:meet the requirements|mark all (?:of )?the requirements)\**_*|Henceforth/i;

/**
 * The book's own trigger phrases, in the order they must be tried: the SET phrases first, since
 * "when the Seasons Change to spring, summer, or autumn" also contains the bare word "spring".
 *
 * Every phrase here was read off the pack sources rather than invented — an improvement whose
 * effect region names a season through some phrase NOT in this table is reported rather than
 * silently dropped, which is the failure mode this table exists to make loud.
 */
const TRIGGERS = [
	// Every season, however the book says it.
	{ seasons: ALL, pattern: /at the start of each season|when the seasons change(?!\s+to)/i },

	// "when the Seasons Change to spring, summer, or autumn" — the seasons are whichever it lists.
	{ pattern: /(?:when |as )?the seasons change to ([a-z, ]*?(?:spring|summer|autumn|winter)[a-z, ]*)/i, listed: true },

	{ seasons: ["spring"], pattern: /each spring|every spring|in spring\b|spring (?:breaks|bursts) forth|the aurochs hunt in spring/i },
	{ seasons: ["summer"], pattern: /each summer|every summer|in summer\b|when summer comes/i },
	{ seasons: ["autumn"], pattern: /each autumn|every autumn|in autumn\b|the autumn harvest is complete|autumn's harvest/i },
	{ seasons: ["winter"], pattern: /each winter|every winter|in winter\b|when winter grips the land|surplus in winter/i },
];

// Anything that mentions a season at all — used to catch a phrasing the table above has not learned.
//
// Deliberately NOT "harvest": every harvest clause in the sources names its season outright ("the
// autumn harvest", "each autumn's harvest"), so the bare word adds no reach — and it does add a
// false alarm, because "Greater Harvest" is the NAME of an improvement that golden-sapling's effect
// marks, in a sentence with no season in it at all.
const ANY_SEASON = /spring|summer|autumn|winter|seasons change|each season/i;

/**
 * The improvement's EFFECT region: the prose that describes what it does once it is built, as
 * opposed to what it costs to build.
 *
 * Requirement rows are the rows with a `track` — that is what a track IS — so the effect region
 * begins after the last of them. Two wrinkles the real sources force:
 *
 *   * `well-trained-militia` and `roadbuilding` have no "Henceforth"/"meet the requirements" marker
 *     at all, so the marker cannot be the anchor; the last tracked row can.
 *   * `additional/rhoillyg-orchard` has its whole effect paragraph GLUED onto its last requirement
 *     row by a bug in the Book II box parser (scripts/import/pdf/improvements.js). Rather than
 *     lose a real improvement to somebody else's bug, the tail of a tracked row is taken too when
 *     that row's own text contains the marker mid-string.
 */
export function effectRegion(list = []) {
	const lastTracked = list.reduce((last, row, i) => (row.track ? i : last), -1);
	const region = list.slice(lastTracked + 1)
		.map(row => row?.content?.text ?? "")
		.filter(Boolean);

	if (lastTracked >= 0) {
		const glued  = list[lastTracked]?.content?.text ?? "";
		const marker = glued.match(EFFECT_MARKER);
		// Only when the marker is INSIDE the row rather than opening it — a requirement row that
		// merely starts with "Henceforth" is not a thing the sources contain, but a row whose text
		// runs on into the effect paragraph is.
		if (marker && marker.index > 0) region.unshift(glued.slice(marker.index));
	}
	return region;
}

// The effect region as clause-sized pieces. Sentence boundaries, because that is the unit the book
// writes a seasonal effect in and the unit the checklist reads one out in. Abbreviations do not
// appear in this prose, so a full stop is reliably a sentence end; "e.g." inside a parenthetical is
// guarded by requiring whitespace and a capital after it.
function clauses(region) {
	return region
		.flatMap(text => text.split(/\n{2,}/))
		.flatMap(block => block.split(/(?<=[.!?])\s+(?=[A-Z*_"])/))
		.map(s => s.trim())
		.filter(Boolean);
}

// "spring, summer, or autumn" → the keys it names, in the book's printed order.
function listedSeasons(fragment) {
	return ALL.filter(key => new RegExp(`\\b${key}\\b`, "i").test(fragment));
}

// EVERY trigger the clause matches, unioned — one sentence can name two seasons and do something
// different in each ("generates +1 Surplus in summer and another +1 when the autumn harvest is
// complete"). Stopping at the first match dropped the second half of those, which is a clause
// missing from the checklist in the season it actually fires.
function seasonsFor(clause) {
	const found = new Set();
	for (const trigger of TRIGGERS) {
		const match = clause.match(trigger.pattern);
		if (!match) continue;
		for (const key of trigger.listed ? listedSeasons(match[1]) : trigger.seasons) found.add(key);
	}
	// In the book's printed order, whatever order the triggers happened to match in.
	return found.size ? ALL.filter(key => found.has(key)) : null;
}

/**
 * The seasonal clauses of one improvement's choice list, plus what was looked at and rejected.
 *
 * Returns `{ clauses, unmatched }` — `unmatched` being effect-region sentences that name a season
 * through a phrase the trigger table does not know. Those are reported by the build and printed
 * into the review file: a new phrasing that silently produced no clause is precisely the rot that
 * would leave an improvement missing from the checklist with nothing to show for it.
 */
export function seasonalClausesFor(list = []) {
	const region = effectRegion(list);
	const out = [], unmatched = [];
	for (const clause of clauses(region)) {
		const seasons = seasonsFor(clause);
		if (seasons) out.push({ seasons, text: clause });
		else if (ANY_SEASON.test(clause)) unmatched.push(clause);
	}
	return { clauses: out, unmatched };
}

/** Season words sitting OUTSIDE the effect region — the rejections a reviewer should check. */
export function rejectedMentions(list = []) {
	const lastTracked = list.reduce((last, row, i) => (row.track ? i : last), -1);
	return list
		.slice(0, lastTracked + 1)
		.map((row, i) => ({ index: i, tracked: Boolean(row.track), text: row?.content?.text ?? "" }))
		.filter(row => ANY_SEASON.test(row.text));
}
