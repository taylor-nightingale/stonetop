// Compiles the translators' files into the language files Foundry actually loads.
//
// Runs as part of `npm run pack`, so a translation ships by editing languages/compendium/<lang>/ and
// nothing else — there is no separate command to forget.
//
// Only entries that are translated AND current are written. Anything untranslated, awaiting review
// or orphaned is left out and falls back to the English in the pack, which is always correct.
// The rest of the language file — the UI strings — is left exactly as it was.
import path from "path";
import { pathToFileURL } from "url";
import { englishCatalogForPack } from "./packCatalog.js";
import { reconcile } from "./reconcile.js";
import {
	TRANSLATED_PACKS, languageFilePath, listLanguages, readAuthoring, readJson, registeredLanguages, writeJson,
} from "./files.js";
import { summarise } from "./report.js";

export async function buildLanguageFiles({ root = "." } = {}) {
	const languages = await listLanguages(root);
	if (!languages.length) return [];

	const registered = new Set(await registeredLanguages(root));
	const built = [];

	for (const lang of languages) {
		const compendium = {};
		for (const pack of TRANSLATED_PACKS) {
			const english = await englishCatalogForPack(pack, root);
			const result  = reconcile(lang, pack, english, await readAuthoring(lang, pack, root));
			console.log(`  ${summarise(result)}`);
			for (const [type, bySlug] of Object.entries(result.toRuntime())) {
				compendium[type] = { ...(compendium[type] ?? {}), ...bySlug };
			}
		}

		const file     = languageFilePath(lang, root);
		const existing = await readJson(file, {});
		const stonetop = { ...(existing.stonetop ?? {}) };
		if (Object.keys(compendium).length) stonetop.compendium = compendium;
		else delete stonetop.compendium;

		await writeJson(file, { ...existing, stonetop });
		console.log(`  Wrote ${path.relative(root, file)}`);
		if (!registered.has(lang)) {
			console.warn(`  ${lang} is not listed in system.json "languages" — Foundry will not offer it.`);
		}
		built.push(lang);
	}
	return built;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	buildLanguageFiles().catch(err => { console.error(err); process.exit(1); });
}
