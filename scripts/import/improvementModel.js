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
import { seasonalClausesFor } from "./seasonalClauses.js";

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
	});

	// The drift detector: if the improvement's own prose names a season but nothing was modelled to
	// fire in one, the model has fallen behind the book.
	const { clauses } = seasonalClausesFor(doc?.system?.choices?.list ?? []);
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
