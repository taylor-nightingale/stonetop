// Migrates translation files after the key scheme itself changes.
//   npm run i18n:rekey           — renames keys against the scheme as of HEAD
//   npm run i18n:rekey -- <ref>  — against that ref instead
//
// A translator's work is filed under `key`, so changing how keys are derived orphans every entry at
// once. The rename is nonetheless exact, not a guess: both schemes are run over the SAME pack
// documents, and every entry carries `path` — its concrete indexed address — alongside `key`. Two
// keys naming one path are the same string before and after, so old → new falls straight out.
//
// The previous scheme is read out of git rather than kept around in the source, which keeps exactly
// one key function in the tree and makes the migration reproducible from any two revisions.
import { execFileSync } from "child_process";
import { pathToFileURL } from "url";
import path from "path";
import { isTranslatableType, translatableEntriesForType } from "../../src/i18n/translatablePaths.js";
import { readPackDocuments } from "./packCatalog.js";
import { AwaitingTranslator } from "./awaiting.js";
import { TRANSLATED_PACKS, awaitingPath, listLanguages, readAuthoring, readJson, writeAuthoring, writeJson } from "./files.js";

const PATHS_MODULE = "src/i18n/translatablePaths.js";
const SLUG_MODULE  = "src/utils/slug.js";

/** The key scheme as of a git ref, imported without putting a second copy in the tree. */
export async function schemeAt(ref, root = ".") {
	const source = execFileSync("git", ["show", `${ref}:${PATHS_MODULE}`], {
		cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024,
	});
	// Its own relative import cannot resolve from a data: URL, so it is pinned to the file on disk.
	// slug.js is a pure function of a string; using today's copy against the old scheme is safe.
	const slugUrl = pathToFileURL(path.resolve(root, SLUG_MODULE)).href;
	const rewritten = source.replace(/from\s+"\.\.\/utils\/slug\.js"/u, `from "${slugUrl}"`);
	return import(`data:text/javascript;base64,${Buffer.from(rewritten).toString("base64")}`);
}

export class KeyRenames {
	constructor(bySlug = new Map()) {
		this.bySlug = bySlug;
	}

	get size() {
		return [...this.bySlug.values()].reduce((n, renames) => n + renames.size, 0);
	}

	renamesFor(slug) {
		return this.bySlug.get(slug) ?? new Map();
	}

	add(slug, from, to) {
		const renames = this.bySlug.get(slug) ?? new Map();
		this.bySlug.set(slug, renames);
		renames.set(from, to);
	}

	/** Rewrites one authoring file's keys, leaving anything the map does not mention untouched. */
	applyTo(authoring) {
		const out = {};
		for (const [slug, entries] of Object.entries(authoring ?? {})) {
			const renames = this.renamesFor(slug);
			out[slug] = Object.fromEntries(
				Object.entries(entries ?? {}).map(([key, entry]) => [renames.get(key) ?? key, entry]));
		}
		return out;
	}
}

/** Pairs the two schemes by `path`, which both agree on, to get old key → new key. */
export function renamesBetween(previous, documents) {
	const renames = new KeyRenames();
	for (const doc of documents) {
		if (!isTranslatableType(doc?.type)) continue;
		const slug = doc.system?.slug;
		if (!slug) continue;

		const now = new Map(translatableEntriesForType(doc.type, doc).map(entry => [entry.path, entry.key]));
		for (const before of previous.translatableEntriesForType(doc.type, doc)) {
			const after = now.get(before.path);
			if (after && after !== before.key) renames.add(slug, before.key, after);
		}
	}
	return renames;
}

export async function rekey({ ref = "HEAD", root = "." } = {}) {
	const previous  = await schemeAt(ref, root);
	const languages = await listLanguages(root);
	const awaiting  = new Map();
	for (const lang of languages) {
		awaiting.set(lang, AwaitingTranslator.fromJson(await readJson(awaitingPath(lang, root), {})));
	}
	let renamed = 0;

	for (const pack of TRANSLATED_PACKS) {
		const documents = await readPackDocuments(path.join(root, "packs", "src", pack));
		const renames   = renamesBetween(previous, documents);
		if (!renames.size) continue;
		renamed += renames.size;

		for (const lang of languages) {
			await writeAuthoring(lang, pack, renames.applyTo(await readAuthoring(lang, pack, root)), root);
			// An acknowledgement addresses an entry by key, so it has to move with it.
			awaiting.set(lang, awaiting.get(lang).renamed(pack, renames.bySlug));
		}
		console.log(`${pack}: ${renames.size} keys renamed in ${languages.join(", ") || "no languages"}`);
	}

	for (const lang of languages) await writeJson(awaitingPath(lang, root), awaiting.get(lang).toJson());

	console.log(`\n${renamed} keys renamed. Now run: npm run i18n:extract`);
	return renamed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const ref = process.argv.slice(2).find(arg => !arg.startsWith("-"));
	rekey({ ref }).catch(err => { console.error(err); process.exit(1); });
}
