// Check every steading improvement's authored model, and write the review file it is checked by.
//
//   node scripts/import/review-improvement-model.js
//
// Each improvement item says what it REQUIRES and what each of its results DOES, authored by hand on
// the item beside the book's own payoff sentence (`_prose`). This writes nothing: it validates the
// pack — a requirement naming a row that no longer exists, a tracked row no requirement mentions, an
// unknown moment, an improvement whose prose names a season with nothing modelled to fire in one —
// and prints the model beside the prose it was read from, so it can be checked against the book
// without opening the pack.
//
// It EXITS NON-ZERO on any of those, which is what stops a rebuild. Authoring by hand buys judgement
// at the cost of drift; these checks are what makes the drift loud.
import { readFileSync, readdirSync, writeFileSync } from "fs";
import path from "path";
import { pathToFileURL } from "node:url";
import { knownMoveSlugs, problemsFor, strayRequirementRows, trackedRows } from "./improvementModel.js";

const ROOT   = "packs/src/steading-improvements";
const DIRS   = ["stonetop", "additional"];
const REVIEW = "helper/improvement-model-review.md";

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

/** Every improvement source, in the order the review prints them. */
export function loadImprovements(root = ROOT) {
	const docs = [];
	for (const dir of DIRS) {
		for (const file of readdirSync(path.join(root, dir)).filter(f => f.endsWith(".json")).sort()) {
			docs.push(JSON.parse(readFileSync(path.join(root, dir, file), "utf8")));
		}
	}
	return docs;
}

export function reviewImprovementModel({ write = true, docs = loadImprovements() } = {}) {
	const moves = knownMoveSlugs();
	const problems = docs.flatMap(doc => problemsFor(doc, moves));
	if (problems.length) return { problems, applied: 0, stated: 0 };

	let applied = 0, stated = 0;
	const sections = [];

	for (const doc of docs) {
		const entry = doc.system;
		const rows  = trackedRows(doc);

		const lines = [`### ${doc.name}\n`, `**Requires:** ${describe(entry.requires, rows)}\n`];
		if (doc._review) lines.push(`> ⚠ ${doc._review}\n`);

		// The book's own outcome prose, in FULL and unsummarised. This is the half that catches an
		// omission: a review that shows only what was modelled cannot show what was missed, and three
		// dropped clauses got through before this was here.
		const outcome = doc._prose ?? [];
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
		`${docs.length} improvements. **${applied}** results the sheet may apply; **${stated}** it states\n` +
		`and leaves to the table.\n\n` +
		`Authored by hand on each improvement item, because classifying a clause needs judgement a\n` +
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

	return { problems: [], applied, stated };
}

function main() {
	const { problems, applied, stated } = reviewImprovementModel();
	if (problems.length) {
		console.error(`improvement model does not match the pack:\n${problems.map(p => `  • ${p}`).join("\n")}`);
		process.exit(1);
	}
	console.log(`improvement model: ${applied} applicable result(s), ${stated} stated; review → ${REVIEW}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main();
}
