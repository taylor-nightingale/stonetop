// Rebuilds every PDF-derived source by running each builder in sequence (stops
// at the first failure) — the compendium pack sources in packs/src/, plus the
// tag definitions in languages/en.json.
// Usage: npm run build-packs
//
// This only regenerates the JSON sources — review `git diff packs/src/ languages/`
// for unintended drift before compiling with `npm run pack`.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Order matters at the front: the journal build links stat-block names against the freshly
// built NPC sources and arcana names against the arcana sources, and build-artifacts reads
// the freshly built journal sources.
export const BUILDERS = [
	"scripts/import/pdf/build-arcana.js",
	"scripts/import/pdf/build-npcs.js",
	"scripts/import/pdf/build-journal.js",
	"scripts/import/build-artifacts.js",
	"scripts/import/pdf/build-tables.js",
	"scripts/import/pdf/build-improvements.js",
	"scripts/import/pdf/build-steadfasts.js",
	// Book I's value tables: the gear the pack is missing, the livestock followers, and the
	// "Common & Special Items" reference page (which links the items it just resolved).
	"scripts/import/build-items.js",
	// Not a pack: writes the tag definitions into languages/en.json. Listed here so a reprint
	// refreshes them along with everything else derived from the books.
	"scripts/import/pdf/build-tag-glossary.js",
	// Also languages/en.json: Book I's "If you want to…" advice. Last, because it links the moves
	// and improvements it cites by reading their ids out of the packs the builders above wrote.
	"scripts/import/pdf/build-advice.js",
];

function main() {
	const root = join(dirname(fileURLToPath(import.meta.url)), "..");
	for (const builder of BUILDERS) {
		console.log(`\n=== ${builder} ===`);
		const { status } = spawnSync(process.execPath, [join(root, builder)], { stdio: "inherit" });
		if (status !== 0) {
			console.error(`${builder} failed (exit ${status}); stopping.`);
			process.exit(status ?? 1);
		}
	}
	console.log("\nAll sources rebuilt. Review `git diff packs/src/ languages/`, then compile with `npm run pack`.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main();
}
