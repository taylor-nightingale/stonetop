#!/usr/bin/env node
// Extracts possession options from each playbook JSON into standalone possession JSON files.
// Run once: node scripts/extract-possessions.js
// Output:   packs/src/possessions/<slug>.json (one file per unique possession slug)

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = join(__dir, "..");
const playbooksDir   = join(root, "packs/src/playbooks");
const possessionsDir = join(root, "packs/src/possessions");

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
function randomId() {
	let id = "";
	for (let i = 0; i < 16; i++) id += CHARS[Math.floor(Math.random() * CHARS.length)];
	return id;
}

const written = new Set();

for (const file of readdirSync(playbooksDir).filter(f => f.endsWith(".json"))) {
	const playbook = JSON.parse(readFileSync(join(playbooksDir, file), "utf8"));
	const sp = playbook.system?.specialPossessions;
	if (!sp?.options?.length) continue;

	for (const opt of sp.options) {
		const slug = opt.slug;
		if (!slug) { console.warn(`Skipping option with no slug in ${file}`); continue; }
		if (written.has(slug)) { console.log(`  skipped duplicate: ${slug}`); continue; }

		const id = randomId();
		const possession = {
			_id:  id,
			_key: `!items!${id}`,
			name: opt.label,
			type: "possession",
			img:  "icons/svg/item-bag.svg",
			system: {
				slug:        slug,
				label:       opt.label        ?? "",
				description: opt.description  ?? "",
				resource:    opt.resource     ?? null,
				outfitItems: opt.outfitItems  ?? [],
				choices:     opt.choices      ?? null,
				scaling:     opt.scaling      ?? null,
				sortOrder:   opt.sortOrder    ?? null,
			},
		};

		const outPath = join(possessionsDir, `${slug}.json`);
		writeFileSync(outPath, JSON.stringify(possession, null, "\t") + "\n", "utf8");
		written.add(slug);
		console.log(`  wrote: ${slug}.json`);
	}
}

console.log(`\nDone. ${written.size} possession files written.`);
