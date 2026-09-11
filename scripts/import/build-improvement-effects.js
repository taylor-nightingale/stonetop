// Merge the hand-authored improvement model into the pack sources.
//
//   node scripts/import/build-improvement-effects.js
//
// data/improvement-effects.json says what each improvement REQUIRES and what it DOES. This writes
// `system.requires` and `system.effects` onto every improvement item and produces a review file that
// prints the model beside the prose it was read from, so it can be checked against the book without
// opening the pack.
//
// A pass over the pack SOURCES rather than the PDF, which is what lets it cover both halves: the
// hand-authored stonetop/ folder and the generated additional/ one. It runs after
// build-improvements.js, so a regeneration of additional/ is immediately re-modelled.
//
// It FAILS rather than writing when the model and the pack disagree — a requirement naming a row that
// no longer exists, a tracked row no requirement mentions, an unknown moment, or an improvement whose
// prose names a season with nothing modelled to fire in one. Authoring by hand buys judgement at the
// cost of drift; these checks are what makes the drift loud.
import { readFileSync, readdirSync, writeFileSync } from "fs";
import path from "path";
import { pathToFileURL } from "node:url";
import { knownMoveSlugs, missingFrom, problemsFor, strayRequirementRows, trackedRows } from "./improvementModel.js";

const ROOT   = "packs/src/steading-improvements";
const DIRS   = ["stonetop", "additional"];
const MODEL  = "data/improvement-effects.json";
const REVIEW = "helper/improvement-model-review.md";

// A requirement is authored in whichever form reads best — a bare slug, a list, or a group. Stored,
// it is always a group: `requires` is an ObjectField, and Foundry will not validate a bare string
// into one. parseRequirement accepts either, so this is purely so the schema can stay simple.
function normalise(raw) {
	if (raw === undefined || raw === null) return null;
	if (typeof raw === "string") return { all: [raw] };
	if (Array.isArray(raw)) return { all: raw.map(normalise) };
	if (Array.isArray(raw.all)) return { all: raw.all.map(normalise) };
	if (Array.isArray(raw.of)) return { any: Number.isInteger(raw.any) ? raw.any : 1, of: raw.of.map(normalise) };
	return raw;
}

const trim = (text, max = 150) => {
	const flat = String(text ?? "").replace(/\s+/g, " ").trim();
	return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

/** The authored requirement, as the book would say it. */
function describe(raw, rows) {
	if (typeof raw === "string") {
		const boxes = rows[raw] ?? 1;
		return boxes > 1 ? `${raw} (${boxes} boxes)` : raw;
	}
	if (Array.isArray(raw)) return raw.map(r => describe(r, rows)).join(" AND ");
	if (raw && Array.isArray(raw.all)) return raw.all.map(r => describe(r, rows)).join(" AND ");
	if (raw && Array.isArray(raw.of)) {
		const n = Number.isInteger(raw.any) ? raw.any : 1;
		return `${n} of (${raw.of.map(r => describe(r, rows)).join(" | ")})`;
	}
	return "—";
}

function fires(when = {}) {
	if (when.kind === "moment") return `at the ${when.moment}`;
	if (when.kind === "turn")   return when.seasons?.length ? `each ${when.seasons.join("/")}` : "every season";
	return "on completion";
}

function verdict(effect) {
	if (effect.grantsMove) return `GRANTS THE MOVE "${effect.grantsMove}" — rolled`;
	if (effect.adjustment) return "ADJUSTS a step — stated";
	// Before the condition, because an advantage clause is REMINDED about whether or not it carries
	// one — the condition only changes what the reminder says. Four of the five carry one.
	if (effect.advantage) {
		return `REMINDS on ${effect.advantage.moves.join(", ")}${effect.condition ? " — conditional" : ""}`;
	}
	if (effect.condition)  return "CONDITIONAL — stated";
	if (effect.change?.formula) return "ROLLED — stated";
	if (Number.isInteger(effect.change?.amount)) {
		const c = effect.change;
		return `APPLIES ${c.amount > 0 ? "+" : ""}${c.amount} ${c.target}`;
	}
	if (effect.listEntry) return `APPLIES → ${effect.listEntry.list}: "${effect.listEntry.text}"`;
	if (effect.set) return `APPLIES ${effect.set.target} = ${JSON.stringify(effect.set.value)}`;
	return "fiction — stated";
}

export function buildImprovementEffects({ write = true } = {}) {
	const model = JSON.parse(readFileSync(MODEL, "utf8"));
	const docs = {}, paths = {};
	for (const dir of DIRS) {
		for (const file of readdirSync(path.join(ROOT, dir)).filter(f => f.endsWith(".json")).sort()) {
			const full = path.join(ROOT, dir, file);
			const doc = JSON.parse(readFileSync(full, "utf8"));
			docs[doc.system.slug] = doc;
			paths[doc.system.slug] = full;
		}
	}

	const moves = knownMoveSlugs();
	const problems = [];
	for (const [slug, entry] of Object.entries(model)) {
		if (slug.startsWith("_")) continue;
		problems.push(...problemsFor(slug, entry, docs[slug], moves));
	}
	problems.push(...missingFrom(model, docs));
	if (problems.length) return { problems, changed: 0, applied: 0, stated: 0 };

	let changed = 0, applied = 0, stated = 0;
	const sections = [];

	for (const [slug, doc] of Object.entries(docs)) {
		const entry = model[slug];
		const rows  = trackedRows(doc);
		const raw   = readFileSync(paths[slug], "utf8");

		doc.system.requires = normalise(entry.requires);
		doc.system.effects  = (entry.effects ?? []).map(e => ({
			...e,
			...(e.requires !== undefined ? { requires: normalise(e.requires) } : {}),
		}));
		// The flat seasonal list this replaces: a clause with no requirement and no structure.
		delete doc.system.seasonal;

		// Strip the payoff prose. It said, in one sentence, exactly what the effects above say clause
		// by clause — and BOTH were extracted for translation, so a translator wrote the payoff twice:
		// 29 strings and 7,848 characters against 6,276 of effect text. Hiding the rows instead was not
		// an option; the improvement item sheet renders `choices`, so a row that survives has to be
		// translated wherever it shows.
		//
		// Safe to delete only because problemsFor has already refused, above, unless `_prose` records
		// this exact text and the improvement models effects to replace it. The build writes nothing
		// when it refuses, so there is no half-stripped state.
		const list = doc.system.choices?.list;
		if (list) {
			const lastTracked = list.reduce((last, row, i) => (row.track ? i : last), -1);
			doc.system.choices.list = list.slice(0, lastTracked + 1);
		}

		const next = `${JSON.stringify(doc, null, 2)}\n`;
		if (next !== raw) { changed++; if (write) writeFileSync(paths[slug], next); }

		const lines = [`### ${doc.name}\n`, `**Requires:** ${describe(entry.requires, rows)}\n`];
		if (entry._review) lines.push(`> ⚠ ${entry._review}\n`);

		// The book's own outcome prose, in FULL and unsummarised. This is the half that catches an
		// omission: a review that shows only what was modelled cannot show what was missed, and three
		// dropped clauses got through before this was here.
		//
		// Read from `_prose` rather than from the pack, because the pack's copy is stripped: the
		// effects below are DISPLAY copy now, deliberately not the book's wording, so without this the
		// review would have nothing left to check them against.
		const outcome = entry._prose ?? [];
		if (outcome.length) {
			lines.push("<details><summary>the book's words</summary>\n");
			lines.push(outcome.map(o => `> ${o.replace(/\n+/g, "\n> ")}`).join("\n>\n"));
			lines.push("\n</details>\n");
		}

		// Untracked rows sitting among the requirements — each is a requirement the extraction gave no
		// box, so it can be neither ticked nor counted. Reported rather than failed: telling one from
		// a stray line of prose needs the book.
		const stray = strayRequirementRows(doc);
		if (stray.length) {
			lines.push(`> ⚠ **untracked rows among the requirements** — check these are not dropped boxes:`);
			lines.push(stray.map(t => `> - ${trim(t, 110)}`).join("\n") + "\n");
		}
		for (const e of entry.effects ?? []) {
			const v = verdict(e);
			v.startsWith("APPLIES") ? applied++ : stated++;
			const own = e.requires !== undefined ? ` _(needs ${describe(e.requires, rows)})_` : "";
			lines.push(`- **${fires(e.when)}** — ${v}${own}\n  - ${trim(e.text)}`);
		}
		sections.push(lines.join("\n"));
	}

	const review = `# Steading improvement model — generated ${new Date().toISOString().slice(0, 10)}\n\n` +
		`${Object.keys(docs).length} improvements. **${applied}** results the sheet may apply; **${stated}** it states\n` +
		`and leaves to the table.\n\n` +
		`Authored by hand in \`${MODEL}\` and merged here, because classifying a clause needs judgement a\n` +
		`parser should not be trusted with. **This file is the review surface:** each improvement's\n` +
		`requirement is printed as the book would say it, and each result beside the sentence it came\n` +
		`from. Check it against Book I/II.\n\n` +
		`A result is APPLIED only when it is a plain integer change, a rating set outright, or a list\n` +
		`entry — with no condition and no step adjustment. Everything else is stated: a die to roll, a\n` +
		`condition the sheet cannot evaluate, an arithmetic it does not perform, or pure fiction.\n\n` +
		`A REMINDS result changes no roll. It marks the moves it names, so the table can see what the\n` +
		`steading is entitled to and pick the roll mode themselves — which is the only honest reading of\n` +
		`the four clauses that wait on fiction ("when you take advantage of the palisade").\n\n` +
		`${sections.join("\n\n")}\n`;
	if (write) writeFileSync(REVIEW, review);

	return { problems: [], changed, applied, stated };
}

function main() {
	const { problems, changed, applied, stated } = buildImprovementEffects();
	if (problems.length) {
		console.error(`improvement model does not match the pack — nothing written:\n${problems.map(p => `  • ${p}`).join("\n")}`);
		process.exit(1);
	}
	console.log(`improvement model: ${changed} file(s) rewritten; ${applied} applicable result(s), ${stated} stated; review → ${REVIEW}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main();
}
