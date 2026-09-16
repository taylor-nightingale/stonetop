// Refreshes a translator's files against the English in packs/src.
//   npm run i18n:extract      — every language that already has files
//   npm run i18n:extract de   — just that one, creating its files if this is the first run
//
// Safe to re-run: existing translations are kept, `source` is refreshed to the current English, and
// anything that drifted is marked in the file for a human to look at. Nothing is ever deleted.
//
// Before reconciling, the corpus is settled as a whole — translations follow strings that moved to
// another pack, and identical English reuses the German it already has. Both are decided on
// byte-identical English, so neither writes a translation; see corpus.js.
import { pathToFileURL } from "url";
import { englishCatalogForPack } from "./packCatalog.js";
import { reconcile } from "./reconcile.js";
import { corpusFor } from "./corpus.js";
import { TRANSLATED_PACKS, listLanguages, writeAuthoring } from "./files.js";
import { TAG_PACK, reconcileTagLabels } from "./tagLabels.js";
import { detail, summarise } from "./report.js";

/** What the corpus pass did, printed once rather than buried per pack. */
function reportCorpus({ relocations, redundant, fills, conflicts }, compositions) {
	for (const { from, to } of relocations) {
		console.log(`  moved       ${from.label}\n           -> ${to.label}  (same English, another pack)`);
	}
	for (const { slug, key, hostKey } of compositions) {
		console.log(`  composed    ${slug} ${key} + ${hostKey}  (folded heading rejoined)`);
	}
	for (const { address } of redundant ?? []) {
		console.log(`  dropped     ${address.label}  (every paragraph already filed elsewhere)`);
	}
	if (fills.length) console.log(`  reused      ${fills.length} translations for identical English`);
	for (const { address, english, germans } of conflicts) {
		console.log(`  ambiguous   ${address.label}: ${JSON.stringify(english.slice(0, 50))} is translated `
			+ `${germans.length} ways — left untranslated for a human`);
	}
}

export async function extract({ lang, root = "." } = {}) {
	const languages = lang ? [lang] : await listLanguages(root);
	if (!languages.length) {
		console.log("No languages yet. Start one with: npm run i18n:extract <lang>   (e.g. de, fr, pt-BR)");
		return [];
	}

	const results = [];
	for (const language of languages) {
		const corpus  = await corpusFor(language, root);
		const settled = corpus.apply();
		const compositions = [];

		for (const pack of TRANSLATED_PACKS) {
			const english = await englishCatalogForPack(pack, root);
			const result  = reconcile(language, pack, english, corpus.packs.get(pack).authoring,
				{ onCompose: composed => compositions.push(composed) });
			await writeAuthoring(language, pack, result.toAuthoring(), root);
			console.log(summarise(result));
			for (const line of detail(result)) console.log(line);
			results.push(result);
		}

		// Tags are gathered across every pack and translated once, so they get one file of their own
		// rather than repeating "close" on each of the hundreds of things that carry it.
		const tags = await reconcileTagLabels(language, root);
		await writeAuthoring(language, TAG_PACK, tags.toAuthoring(), root);
		console.log(summarise(tags));
		for (const line of detail(tags)) console.log(line);
		results.push(tags);

		reportCorpus(settled, compositions);
	}
	return results;
}

// The first bare word is the language. Flags are skipped, so the older `-- --lang de` spelling
// still lands on `de` rather than on `--lang`.
function langArg(argv) {
	return argv.slice(2).find(arg => !arg.startsWith("-"));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	extract({ lang: langArg(process.argv) }).catch(err => { console.error(err); process.exit(1); });
}
