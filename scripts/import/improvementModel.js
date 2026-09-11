// Checking the hand-authored improvement model against the pack it describes.
//
// data/improvement-effects.json is written by hand because classifying a clause needs judgement a
// regex should not be trusted with — that Township's winter clause REPLACES a die rather than adding
// to it. The cost of authoring by hand is drift: a requirement row renamed in the pack, or an
// improvement whose prose grows a seasonal clause nobody modelled, and nothing says so.
//
// So every check below exists to make that drift loud. Pure and dependency-free; the writer is
// build-improvement-effects.js beside it.

import { readFileSync, readdirSync } from "fs";
import path from "path";
import { Moments } from "../../src/model/data/steading/Moments.js";
import { Seasons } from "../../src/model/data/steading/Seasons.js";
import { gluedPayoffRow, seasonalClausesIn } from "./seasonalClauses.js";

/** Every move slug in the moves pack — what a result's `grantsMove` has to name. */
export function knownMoveSlugs(root = "packs/src/moves") {
	const slugs = new Set();
	for (const dir of readdirSync(root, { withFileTypes: true })) {
		if (!dir.isDirectory() || dir.name === "_folders") continue;
		for (const file of readdirSync(path.join(root, dir.name)).filter(f => f.endsWith(".json"))) {
			const doc = JSON.parse(readFileSync(path.join(root, dir.name, file), "utf8"));
			if (doc?.system?.slug) slugs.add(doc.system.slug);
		}
	}
	return slugs;
}

/** Every row slug an expression names, however deeply nested. */
export function requirementSlugs(raw) {
	if (typeof raw === "string") return [raw];
	if (Array.isArray(raw)) return raw.flatMap(requirementSlugs);
	if (raw && Array.isArray(raw.all)) return raw.all.flatMap(requirementSlugs);
	if (raw && Array.isArray(raw.of))  return raw.of.flatMap(requirementSlugs);
	return [];
}

/**
 * The improvement's PAYOFF rows: everything after the last requirement row.
 *
 * A requirement row is exactly a row carrying a `track` — that is what a track IS — so what follows
 * the last of them is the book's "When you meet the requirements… Henceforth…" sentence. Verified
 * across all 24 improvements: every one has such a tail, and every one has `effects` decomposing it.
 *
 * Empty once the strip has run, which is the shape every caller has to tolerate.
 */
export function payoffRows(doc) {
	const rows = doc?.system?.choices?.list ?? [];
	const lastTracked = rows.reduce((last, row, i) => (row.track ? i : last), -1);
	return rows
		.slice(lastTracked + 1)
		.map(row => (row?.content?.text ?? "").trim())
		.filter(Boolean);
}

/** The tracked rows an improvement actually has, as slug → box count. */
export function trackedRows(doc) {
	const rows = {};
	for (const row of doc?.system?.choices?.list ?? []) {
		if (row?.slug && row?.track) rows[row.slug] = row.track.max ?? 1;
	}
	return rows;
}

/**
 * Everything wrong with one improvement's authored model, as human sentences.
 *
 * `entry` is its block from improvement-effects.json; `doc` is the pack item.
 */
export function problemsFor(slug, entry, doc, moveSlugs = null) {
	const problems = [];
	if (!doc) return [`${slug}: named in improvement-effects.json but not in the pack`];

	const rows = trackedRows(doc);
	const known = new Set(Object.keys(rows));

	// `_prose` is the book's payoff sentence, which used to live in the pack as a second copy of
	// everything `effects` says. It moved here when that copy was stripped, and these three checks are
	// what keep the move honest — without them the strip is a delete with nothing watching it.
	const prose = entry._prose ?? [];
	const payoff = payoffRows(doc);
	if (!prose.length) {
		problems.push(`${slug}: has no _prose — the book's payoff sentence has to be recorded before the pack's copy is stripped`);
	}
	if (payoff.length && !(entry.effects ?? []).length) {
		// The refusal that matters: a parser regression that empties `effects` must never let the
		// strip proceed, or the book's payoff is deleted with nothing left saying what it was.
		problems.push(`${slug}: has ${payoff.length} payoff row(s) to strip but models no effects`);
	}
	// The Book II box parser has, before now, run an improvement's whole payoff paragraph onto the end
	// of its last requirement row. Prose glued in there is prose the strip cannot reach: it would stay
	// in the pack, translated a second time, with every check above passing.
	const glued = gluedPayoffRow(doc?.system?.choices?.list ?? []);
	if (glued) {
		problems.push(`${slug}: its payoff is glued onto the last requirement row — fix the box parser; the strip cannot reach it there`);
	}
	if (payoff.length && prose.length && payoff.join("\n") !== prose.join("\n")) {
		// The pack still carries the prose, and it no longer matches what was recorded — so a builder
		// upstream reworded it. Loud, because the alternative is stripping the new wording and keeping
		// the old as the review surface, which is a lie nobody would notice.
		problems.push(`${slug}: the pack's payoff rows no longer match _prose — a builder reworded them; reconcile against the book before stripping`);
	}

	// Every requirement — the improvement's own, and any a single result narrows further — must name
	// rows that exist. A typo here silently makes a result that can never hold.
	const named = new Set();
	const checkRequirement = (raw, where) => {
		for (const s of requirementSlugs(raw)) {
			named.add(s);
			if (!known.has(s)) problems.push(`${slug}: ${where} names "${s}", which is not a tracked row`);
		}
	};
	checkRequirement(entry.requires, "requires");
	(entry.effects ?? []).forEach((e, i) => {
		if (e.requires !== undefined) checkRequirement(e.requires, `effects[${i}].requires`);
	});

	// A tracked row no requirement mentions is a box the table can tick that means nothing.
	for (const row of Object.keys(rows)) {
		if (!named.has(row)) problems.push(`${slug}: tracked row "${row}" is named by no requirement`);
	}

	// A result has to say something, and a moment has to be one we know.
	(entry.effects ?? []).forEach((e, i) => {
		if (!e.text || !String(e.text).trim()) problems.push(`${slug}: effects[${i}] has no text`);
		const when = e.when ?? {};
		if (when.kind === "moment" && !Moments.has(when.moment)) {
			problems.push(`${slug}: effects[${i}] fires at unknown moment "${when.moment}"`);
		}
		for (const key of when.seasons ?? []) {
			if (!Seasons.all().some(s => s.key === key)) {
				problems.push(`${slug}: effects[${i}] names unknown season "${key}"`);
			}
		}
		if (when.kind === "moment" && when.seasons?.length) {
			problems.push(`${slug}: effects[${i}] is a moment; its season comes from the moment, not from seasons[]`);
		}
		// A granted move is an ordinary item in the moves pack, rolled through the ordinary pipeline.
		// A slug that resolves to nothing renders as an empty row with no way to see why.
		if (e.grantsMove && moveSlugs && !moveSlugs.has(e.grantsMove)) {
			problems.push(`${slug}: effects[${i}] grants move "${e.grantsMove}", which is not in the moves pack`);
		}
		// Advantage is a REMINDER drawn on the named move's own row, so a slug that resolves to nothing
		// is a reminder nobody will ever see — silently, since there is no row for it to be absent from.
		for (const move of e.advantage?.moves ?? []) {
			if (moveSlugs && !moveSlugs.has(move)) {
				problems.push(`${slug}: effects[${i}] grants advantage on "${move}", which is not in the moves pack`);
			}
		}
	});

	// The drift detector: if the improvement's own prose names a season but nothing was modelled to
	// fire in one, the model has fallen behind the book.
	//
	// Read from `_prose`, not from the pack: the payoff rows this used to scan are stripped, and a
	// detector pointed at rows that no longer exist finds no clauses, reports no problem, and is
	// indistinguishable from one that is working.
	const { clauses } = seasonalClausesIn(prose);
	const recurring = (entry.effects ?? []).filter(e => ["turn", "moment"].includes(e.when?.kind));
	if (clauses.length && !recurring.length) {
		problems.push(`${slug}: its effect prose names a season, but no turn/moment result is modelled`);
	}

	return problems;
}

/**
 * Untracked rows sitting among an improvement's requirements.
 *
 * Each is a candidate requirement the extraction gave no box — "Someone to mind the herd and stable,
 * full time", "Pulling Together, costing a month and 1 Surplus" — which can then be neither ticked
 * nor counted toward completion. Two of these were live.
 *
 * Reported, never failed: telling a dropped requirement from a stray line of the outcome prose needs
 * the book, so this feeds the review file and a human decides.
 */
export function strayRequirementRows(doc) {
	const rows = doc?.system?.choices?.list ?? [];
	const first = rows.findIndex(r => r?.track);
	if (first < 0) return [];
	const header  = /requires?\b|^\s*and\b|^\s*or\b|each tactic/i;
	const outcome = /meet the requirements|mark all|Henceforth|cease to meet/i;
	return rows
		.slice(first)
		.filter(r => !r?.track)
		.map(r => (r?.content?.text ?? "").trim())
		.filter(t => t && !header.test(t) && !outcome.test(t));
}

/** Improvements in the pack that the curated file says nothing about. */
export function missingFrom(model, docsBySlug) {
	return Object.keys(docsBySlug)
		.filter(slug => !slug.startsWith("_") && !model[slug])
		.map(slug => `${slug}: in the pack, but absent from improvement-effects.json`);
}
