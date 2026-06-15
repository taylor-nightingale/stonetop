// One-time, idempotent converter: turn the legacy free-string Selection fields on npc items
// (followers / NPCs) into the structured Selection shape — `tags` (multi), `instinct` and
// `cost` (single). Outfit-item tags are a different field and are left alone.
//
//   node scripts/migrate-tags-packs.js
//
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Selection } from "../src/model/data/Selection.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC  = join(ROOT, "packs/src");

function walk(dir) {
	return readdirSync(dir).flatMap(name => {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) return name === "_folders" ? [] : walk(p);
		return p.endsWith(".json") ? [p] : [];
	});
}

function detectIndent(text) {
	const m = text.match(/\n([ \t]+)"/);
	return m ? m[1] : "\t";
}

let changed = 0;
for (const file of walk(SRC)) {
	const before = readFileSync(file, "utf8");
	const doc = JSON.parse(before);
	if (doc.type !== "npc") continue;
	const sys = doc.system ?? {};
	let touched = false;
	for (const [field, multi] of [["tags", true], ["instinct", false], ["cost", false]]) {
		if (typeof sys[field] === "string") {
			sys[field] = Selection.fromStored(sys[field], { multi }).toRaw();
			touched = true;
		}
	}
	if (!touched) continue;

	const indent  = detectIndent(before);
	const trailing = before.endsWith("\n") ? "\n" : "";
	writeFileSync(file, JSON.stringify(doc, null, indent) + trailing);
	changed++;
	console.log("migrated", file.replace(ROOT + "/", ""));
}
console.log(`\nDone. ${changed} npc item(s) changed.`);
