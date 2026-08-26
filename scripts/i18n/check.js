// Reports translation coverage and fails on drift, without writing anything.
//   npm run i18n:check
//
// Untranslated strings are not a failure — a translation in progress is the normal state, and an
// untranslated string simply shows English. Entries needing review and orphans ARE a failure: they
// mean a translator's work no longer lines up with the packs and someone has to look.
import { pathToFileURL } from "url";
import { englishCatalogForPack } from "./packCatalog.js";
import { reconcile } from "./reconcile.js";
import { TRANSLATED_PACKS, listLanguages, readAuthoring, registeredLanguages } from "./files.js";
import { detail, summarise } from "./report.js";

export async function check({ root = "." } = {}) {
	const languages = await listLanguages(root);
	if (!languages.length) {
		console.log("No compendium translations.");
		return true;
	}
	const registered = new Set(await registeredLanguages(root));

	let clean = true;
	for (const lang of languages) {
		if (!registered.has(lang)) {
			console.warn(`${lang}: not listed in system.json "languages" — Foundry will not offer it.`);
			clean = false;
		}
		for (const pack of TRANSLATED_PACKS) {
			const english = await englishCatalogForPack(pack, root);
			const result  = reconcile(lang, pack, english, await readAuthoring(lang, pack, root));
			console.log(summarise(result));
			for (const line of detail(result)) console.log(line);
			if (!result.isClean) clean = false;
		}
	}
	if (!clean) console.error("\nRun `npm run i18n:extract` to refresh the files, then resolve the entries above.");
	return clean;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	check().then(ok => process.exit(ok ? 0 : 1)).catch(err => { console.error(err); process.exit(1); });
}
