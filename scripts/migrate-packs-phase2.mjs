#!/usr/bin/env node
/**
 * Phase 2 pack migration: move flags.stonetop data into system fields.
 *
 * Targets:
 *   packs/src/arcana/major/ — slug, major, front, back → system
 *   packs/src/arcana/minor/ — slug, front, back → system
 *   packs/src/steading-improvements/ — slug, sortOrder, choices → system
 *
 * Also fixes img paths: modules/stonetop/ → systems/stonetop/
 *
 * Usage:
 *   node scripts/migrate-packs-phase2.mjs           # transform in place
 *   node scripts/migrate-packs-phase2.mjs --dry-run # preview only
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir    = dirname(fileURLToPath(import.meta.url));
const ROOT     = resolve(__dir, "..");
const DRY_RUN  = process.argv.includes("--dry-run");

const TARGETS = [
	join(ROOT, "packs/src/arcana/major"),
	join(ROOT, "packs/src/arcana/minor"),
	join(ROOT, "packs/src/steading-improvements"),
];

let changed = 0;
let skipped = 0;

for (const dir of TARGETS) {
	const files = readdirSync(dir).filter(f => f.endsWith(".json") && !f.startsWith("_"));
	for (const file of files) {
		const path = join(dir, file);
		const raw  = readFileSync(path, "utf8");
		const doc  = JSON.parse(raw);

		const st = doc.flags?.stonetop;
		if (!st || Object.keys(st).length === 0) {
			skipped++;
			continue;
		}

		// Merge flags.stonetop fields into system
		doc.system = { ...doc.system, ...st };

		// Clear the stonetop flag namespace
		doc.flags = {};

		// Fix img path
		if (doc.img && doc.img.includes("modules/stonetop/")) {
			doc.img = doc.img.replace("modules/stonetop/", "systems/stonetop/");
		}

		const out = JSON.stringify(doc, null, "\t") + "\n";

		if (DRY_RUN) {
			console.log(`[dry-run] would update: ${file}`);
			console.log("  system keys added:", Object.keys(st).join(", "));
		} else {
			writeFileSync(path, out, "utf8");
			console.log(`updated: ${file}`);
		}
		changed++;
	}
}

console.log(`\n${DRY_RUN ? "[dry-run] " : ""}Done: ${changed} updated, ${skipped} skipped (already clean).`);
