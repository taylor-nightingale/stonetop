// Checking each improvement's authored model against the rows it actually has.
//
// What an improvement REQUIRES and what each of its results DOES is written by hand on the item,
// because classifying a clause needs judgement a regex should not be trusted with — that Township's
// winter clause REPLACES a die rather than adding to it. The cost of authoring by hand is drift: a
// requirement naming a row that was renamed, a box that answers no requirement, an improvement whose
// prose names a season nobody modelled a result for.
//
// So every check below exists to make that drift loud. Pure and dependency-free; the review file is
// written by review-improvement-model.js beside it.

import { readFileSync, readdirSync } from "fs";
import path from "path";
import { Moments } from "../../src/model/data/steading/Moments.js";
import { Seasons } from "../../src/model/data/steading/Seasons.js";
import { seasonalClausesIn } from "./seasonalClauses.js";

/** Every `system.slug` in a pack source tree, across all of its folders. */
export function packSlugs(root) {
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

/** Every move slug in the moves pack — what a result's `grantsMove` has to name. */
export const knownMoveSlugs = (root = "packs/src/moves") => packSlugs(root);

/** Every improvement in the pack, both halves. */
export const improvementSlugs = (root = "packs/src/steading-improvements") => packSlugs(root);

/**
 * The call-outs whose item the journal would link to and miss.
 *
 * The journal stamps each "Steading improvement" box with `improvementUuid(slug)`, read out of the
 * printed box. That UUID used to be guaranteed to resolve: the same parse wrote the item. Nothing
 * regenerates the item now, so a box the parser reads differently — or an improvement renamed in the
 * pack — leaves a link pointing at nothing, and a dead link in a journal entry looks like a live one.
 */
export function danglingImprovementLinks(linked, known) {
	return [...linked]
		.filter(slug => !known.has(slug))
		.map(slug => `its "Steading improvement" box links "${slug}", which is in no improvement source`);
}

/** Every row slug an expression names, however deeply nested. */
export function requirementSlugs(raw) {
	if (typeof raw === "string") return [raw];
	if (Array.isArray(raw)) return raw.flatMap(requirementSlugs);
	if (raw && Array.isArray(raw.all)) return raw.all.flatMap(requirementSlugs);
	if (raw && Array.isArray(raw.of))  return raw.of.flatMap(requirementSlugs);
	return [];
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
 * `doc` is the pack source: `system.requires` and `system.effects` are the model, `_prose` the book's
 * own payoff sentence they were read from.
 */
export function problemsFor(doc, moveSlugs = null) {
	const problems = [];
	const slug = doc?.system?.slug;
	if (!slug) return ["an improvement source carries no system.slug"];

	const entry = doc.system;
	const rows = trackedRows(doc);
	const known = new Set(Object.keys(rows));

	// `_prose` is the book's own payoff sentence, kept beside the effects modelled from it. It is the
	// only copy of the book's wording in the repo — the improvement's own rows carry the requirements
	// and `effects[].text` is display copy, not a quotation — so without it the review file has nothing
	// to check the model against, and an omitted clause looks exactly like a complete one.
	const prose = doc._prose ?? [];
	if (!prose.length) {
		problems.push(`${slug}: has no _prose — record the book's payoff sentence, or the review cannot show what was missed`);
	}
	if (!(entry.effects ?? []).length) {
		problems.push(`${slug}: models no effects — every improvement's payoff decomposes into at least one`);
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
