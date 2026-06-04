#!/usr/bin/env node
// Replaces specialPossessions.options[] with specialPossessions.slugs[] in each playbook JSON.
// Run once: node scripts/update-playbook-possessions.js

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = join(__dir, "..");
const playbooksDir = join(root, "packs/src/playbooks");

for (const file of readdirSync(playbooksDir).filter(f => f.endsWith(".json"))) {
	const playbook = JSON.parse(readFileSync(join(playbooksDir, file), "utf8"));
	const sp = playbook.system?.specialPossessions;
	if (!sp?.options) { console.log(`  skipped (no options): ${file}`); continue; }

	const slugs = sp.options.map(o => o.slug);
	const updated = {
		pickNote:    sp.pickNote,
		pickCount:   sp.pickCount,
		preselected: sp.preselected ?? [],
		slugs,
	};
	playbook.system.specialPossessions = updated;

	writeFileSync(join(playbooksDir, file), JSON.stringify(playbook, null, "\t") + "\n", "utf8");
	console.log(`  updated: ${file} → slugs: [${slugs.join(", ")}]`);
}

console.log("\nDone.");
