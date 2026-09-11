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
	"scripts/import/pdf/build-steadfasts.js",
	// Not a pack: writes the tag definitions into languages/en.json. Listed here so a reprint
	// refreshes them along with everything else derived from the books.
	"scripts/import/pdf/build-tag-glossary.js",
	// Also languages/en.json: Book I's "If you want to…" advice. Late, because it links the moves
	// and improvements it cites by reading their ids out of the packs the builders above wrote.
	"scripts/import/pdf/build-advice.js",
	// Book I's value tables: the gear the pack is missing, the livestock followers, the
	// "Common & Special Items" reference page (which links the items it just resolved), and the
	// Coins sidebar written into languages/en.json beside the advice.
	//
	// AFTER build-advice: the sidebar hangs off the same topic key as the advice it is shown with, so
	// running it last lets it check that pairing against freshly generated advice and fail loudly
	// rather than leaving a ? button that quietly shows only half of what it should.
	"scripts/import/build-items.js",
	// Book I's reference articles — "Gear & Possessions" and "If You Want To…" — into the reference
	// pack. LAST: its value tables link the items build-items.js has just written.
	"scripts/import/build-book-one.js",
	// Not a builder: writes nothing but its review file. The steading improvements are hand-authored
	// on both halves now, so this checks what they require and what each of their results does against
	// the rows they actually have, and FAILS the rebuild when they have drifted apart.
	"scripts/import/review-improvement-model.js",
	// Lifts each steading article's per-season "Impressions" lines into its steadfast. After
	// build-journal (which writes the article it reads) and after build-steadfasts (which owns the
	// steadfasts folder, though it protects the hand-authored stonetop.json by name).
	"scripts/import/build-steading-impressions.js",
];

// Flags a builder needs to write everything it owns. build-arcana writes the arcana CARDS only when
// asked — with no flags it writes nothing at all, just its review report. Leaving it flagless here
// meant the cards were never re-derived, so a broken heuristic could sit in the back parser
// indefinitely with no diff and no failing test to show for it.
export const BUILDER_ARGS = {
	"scripts/import/pdf/build-arcana.js": ["--write-arcana", "--write-minor"],
};

function main() {
	const root = join(dirname(fileURLToPath(import.meta.url)), "..");
	for (const builder of BUILDERS) {
		console.log(`\n=== ${builder} ===`);
		const args = BUILDER_ARGS[builder] ?? [];
		const { status } = spawnSync(process.execPath, [join(root, builder), ...args], { stdio: "inherit" });
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
