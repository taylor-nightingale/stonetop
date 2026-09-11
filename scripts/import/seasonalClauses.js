// Lifting an improvement's SEASONAL clauses out of its effect prose.
//
// Pure and dependency-free so it can be tested against the real sources.
//
// The job used to be two: find the improvement's effect region inside its choice list, then read the
// seasons out of it. The first half is gone — the payoff prose is no longer a row in the pack (it was
// a second copy of everything `system.effects` says, and both halves were extracted for translation),
// so the region arrives already isolated as the improvement's `_prose`.
//
// What remains is the half a keyword sweep gets wrong: which of the book's many phrasings for a
// season a clause is using. That feeds the drift detector — an improvement whose prose names a season
// with nothing modelled to fire in one has fallen behind the book.

import { Seasons } from "../../src/model/data/steading/Seasons.js";

const ALL = Seasons.all().map(s => s.key);

/**
 * The book's own trigger phrases, in the order they must be tried: the SET phrases first, since
 * "when the Seasons Change to spring, summer, or autumn" also contains the bare word "spring".
 *
 * Every phrase here was read off the real sources rather than invented — an improvement whose payoff
 * prose names a season through some phrase NOT in this table is reported rather than silently
 * dropped, which is the failure mode this table exists to make loud.
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

// The payoff prose as clause-sized pieces. Sentence boundaries, because that is the unit the book
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
 * The seasonal clauses of an improvement's payoff prose, plus what was looked at and rejected.
 *
 * Returns `{ clauses, unmatched }` — `unmatched` being sentences that name a season through a phrase
 * the trigger table does not know. A new phrasing that silently produced no clause is precisely the
 * rot that would leave an improvement missing from the checklist with nothing to show for it.
 */
export function seasonalClausesIn(region = []) {
	const out = [], unmatched = [];
	for (const clause of clauses(region)) {
		const seasons = seasonsFor(clause);
		if (seasons) out.push({ seasons, text: clause });
		else if (ANY_SEASON.test(clause)) unmatched.push(clause);
	}
	return { clauses: out, unmatched };
}
