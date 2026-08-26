// Refreshes a translator's files against the English in packs/src.
//   npm run i18n:extract              — every language under languages/compendium/
//   npm run i18n:extract -- --lang de — just one
//
// Safe to re-run: existing translations are kept, `source` is refreshed to the current English, and
// anything that drifted is marked in the file for a human to look at. Nothing is ever deleted.
import { pathToFileURL } from "url";
import { englishCatalogForPack } from "./packCatalog.js";
import { reconcile } from "./reconcile.js";
import { TRANSLATED_PACKS, listLanguages, readAuthoring, writeAuthoring } from "./files.js";
import { detail, summarise } from "./report.js";

export async function extract({ lang, root = "." } = {}) {
	const languages = lang ? [lang] : await listLanguages(root);
	if (!languages.length) {
		console.log("No languages yet. Start one with: mkdir -p languages/compendium/<lang>");
		return [];
	}

	const results = [];
	for (const language of languages) {
		for (const pack of TRANSLATED_PACKS) {
			const english = await englishCatalogForPack(pack, root);
			const result  = reconcile(language, pack, english, await readAuthoring(language, pack, root));
			await writeAuthoring(language, pack, result.toAuthoring(), root);
			console.log(summarise(result));
			for (const line of detail(result)) console.log(line);
			results.push(result);
		}
	}
	return results;
}

function langArg(argv) {
	const i = argv.indexOf("--lang");
	return i >= 0 ? argv[i + 1] : undefined;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	extract({ lang: langArg(process.argv) }).catch(err => { console.error(err); process.exit(1); });
}
