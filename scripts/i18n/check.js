// Reports translation coverage and fails on drift, without writing anything.
//   npm run i18n:check
//
// Untranslated strings are not a failure — a translation in progress is the normal state, and an
// untranslated string simply shows English. Entries needing review and orphans ARE a failure: they
// mean a translator's work no longer lines up with the packs and someone has to look.
//
// Unless someone already has. `_awaiting.json` lists the entries a human has triaged and handed to
// the translator; those still print, but only drift nobody has seen yet goes red.
import { pathToFileURL } from "url";
import { englishCatalogForPack } from "./packCatalog.js";
import { reconcile } from "./reconcile.js";
import { TRANSLATED_PACKS, awaitingPath, listLanguages, readJson } from "./files.js";
import { corpusFor } from "./corpus.js";
import { reconcileTagLabels } from "./tagLabels.js";
import { reconcileUiStrings } from "./uiStrings.js";
import { AwaitingTranslator } from "./awaiting.js";
import { detail, staleLines, summarise } from "./report.js";

export async function check({ root = "." } = {}) {
	const languages = await listLanguages(root);
	if (!languages.length) {
		console.log("No compendium translations.");
		return true;
	}
	let clean = true;
	for (const lang of languages) {
		const awaiting = AwaitingTranslator.fromJson(await readJson(awaitingPath(lang, root), {}));
		const flagged  = [];

		const report = (result) => {
			console.log(summarise(result));
			for (const line of detail(result, awaiting)) console.log(line);
			flagged.push(...result.flaggedEntries);
		};

		// The same corpus pass extract performs, in memory only: without it an orphan that extract
		// would relocate to another pack reads here as unresolved drift and fails the build.
		const corpus = await corpusFor(lang, root);
		corpus.apply();

		for (const pack of TRANSLATED_PACKS) {
			const english = await englishCatalogForPack(pack, root);
			report(reconcile(lang, pack, english, corpus.packs.get(pack).authoring));
		}
		report(await reconcileTagLabels(lang, root));
		// The sheet's own words, which live in languages/<lang>.json rather than in a pack. Reported
		// last because it is the only line a translator can act on without opening a pack file.
		report(await reconcileUiStrings(lang, root));

		const unacknowledged = flagged.filter(f => !awaiting.has(f.pack, f.slug, f.entry.key));
		const stale          = awaiting.staleAgainst(flagged);
		for (const line of staleLines(stale)) console.log(line);

		const waiting = flagged.length - unacknowledged.length;
		console.log(`${lang}: ${waiting} awaiting translator, ${unacknowledged.length} new`);
		if (unacknowledged.length) clean = false;
	}
	if (!clean) console.error("\nRun `npm run i18n:extract` to refresh the files, then resolve the entries above.");
	return clean;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	check().then(ok => process.exit(ok ? 0 : 1)).catch(err => { console.error(err); process.exit(1); });
}
