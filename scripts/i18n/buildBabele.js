// Compiles the translators' files into the Babele translation files the system ships.
//
// Runs as part of `npm run pack`, so a translation reaches the game by editing
// languages/compendium/<lang>/ and nothing else.
//
// Output lands where Babele looks for a system's own translations — see
// setSystemTranslationsDir("babele") in stonetop.js:
//   babele/<lang>/stonetop.<pack>.json
//
// Entries are keyed by document `_id` (Babele resolves _id → name → sourceId). The ids in packs/src
// are stable and committed, so renaming a playbook in English cannot detach its translation the way
// Babele's default name matching would.
//
// Only entries that are translated AND current are written; anything untranslated, awaiting review
// or orphaned is left out and falls back to the English in the pack.
import path from "path";
import { pathToFileURL } from "url";
import { englishCatalog, readPackDocuments } from "./packCatalog.js";
import { reconcile } from "./reconcile.js";
import { TRANSLATED_PACKS, listLanguages, readAuthoring, readJson, writeJson } from "./files.js";
import { summarise } from "./report.js";
import { stonetopMapping } from "../../src/i18n/babeleConverter.js";

const NAME_KEY = "name";

export const babeleFilePath = (lang, pack, root = ".") =>
	path.join(root, "babele", lang, `stonetop.${pack}.json`);

/** Slug → the identity Babele needs, from the pack sources. */
export function documentIdentities(documents) {
	const bySlug = new Map();
	for (const document of documents ?? []) {
		const slug = document?.system?.slug;
		if (slug && document._id) bySlug.set(slug, { id: document._id, name: document.name });
	}
	return bySlug;
}

/**
 * One Babele translation file: {label, mapping, entries}.
 * @param {string} label            the compendium label
 * @param {object} runtime          reconcile().toRuntime() — type → slug → key → text
 * @param {Map} identities          slug → {id, name}
 */
export function babeleTranslationFile(label, runtime, identities) {
	const entries = {};
	for (const bySlug of Object.values(runtime)) {
		for (const [slug, strings] of Object.entries(bySlug)) {
			const identity = identities.get(slug);
			if (!identity) continue;

			const { [NAME_KEY]: name, ...system } = strings;
			const entry = {};
			if (name) entry[NAME_KEY] = name;
			if (Object.keys(system).length) entry.stonetop = system;
			if (Object.keys(entry).length) entries[identity.id] = entry;
		}
	}
	return { label, mapping: stonetopMapping(), entries };
}

async function packLabels(root) {
	const manifest = await readJson(path.join(root, "system.json"), {});
	return new Map((manifest.packs ?? []).map(p => [p.name, p.label ?? p.name]));
}

export async function buildBabeleFiles({ root = "." } = {}) {
	const languages = await listLanguages(root);
	if (!languages.length) return [];

	const labels = await packLabels(root);
	const built = [];

	for (const lang of languages) {
		for (const pack of TRANSLATED_PACKS) {
			const documents = await readPackDocuments(path.join(root, "packs", "src", pack));
			const result = reconcile(lang, pack, englishCatalog(documents), await readAuthoring(lang, pack, root));
			console.log(`  ${summarise(result)}`);

			const file = babeleFilePath(lang, pack, root);
			await writeJson(file, babeleTranslationFile(
				labels.get(pack) ?? pack,
				result.toRuntime(),
				documentIdentities(documents),
			));
			console.log(`  Wrote ${path.relative(root, file)}`);
			built.push({ lang, pack });
		}
	}
	return built;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	buildBabeleFiles().catch(err => { console.error(err); process.exit(1); });
}
