// Rebuilds every PDF-derived compendium pack source in packs/src/ by running
// each per-pack builder in sequence (stops at the first failure).
// Usage: npm run build-packs
//
// This only regenerates the JSON sources — review `git diff packs/src/` for
// unintended drift before compiling with `npm run pack`.
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
	console.log("\nAll pack sources rebuilt. Review `git diff packs/src/`, then compile with `npm run pack`.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main();
}
