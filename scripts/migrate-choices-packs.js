// One-time, idempotent converter that normalizes choice-group data in pack JSON to the
// current shape (see src/migration/migrateChoices.js):
//   - heading/follower rows → entry (+ followers[])
//   - content renames: subHeading → subtitle, subNote → subtitleNote, note → content.titleNote
//   - row-level `input` gains a `type` ("inline" by default)
//
//   node scripts/migrate-choices-packs.js
//
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { migrateChoicesField } from "../src/migration/migrateChoices.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC  = join(ROOT, "packs/src");

function walk(dir) {
	return readdirSync(dir).flatMap(name => {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) return name === "_folders" ? [] : walk(p);
		return p.endsWith(".json") ? [p] : [];
	});
}

// Every place a choice group can live on a document's system data.
function migrateSystem(sys) {
	if (!sys || typeof sys !== "object") return;
	migrateChoicesField(sys.choices);
	migrateChoicesField(sys.specialPossessions);
	migrateChoicesField(sys.front?.unlock);
	migrateChoicesField(sys.back?.unlock);
	migrateChoicesField(sys.back?.choices);
	migrateChoicesField(sys.introductions?.step4);
	migrateChoicesField(sys.introductions?.step6);
}

// Reuse the file's own indentation + trailing-newline so unrelated files are not reformatted.
function detectIndent(text) {
	const m = text.match(/\n([ \t]+)"/);
	return m ? m[1] : "\t";
}

let changed = 0;
for (const file of walk(SRC)) {
	const before = readFileSync(file, "utf8");
	const doc = JSON.parse(before);
	const semanticBefore = JSON.stringify(doc);
	migrateSystem(doc.system ?? doc);
	if (JSON.stringify(doc) === semanticBefore) continue; // no data change → leave file untouched

	const indent  = detectIndent(before);
	const trailing = before.endsWith("\n") ? "\n" : "";
	writeFileSync(file, JSON.stringify(doc, null, indent) + trailing);
	changed++;
	console.log("migrated", file.replace(ROOT + "/", ""));
}
console.log(`\nDone. ${changed} file(s) changed.`);
