// The English side of a translation: every translatable string in a pack's committed sources,
// filed under the same keys a translator's file uses.
//
// Both the extractor and the language-file build read the packs through here, so a translation is
// always reconciled against the English that is actually in packs/src right now — not against
// whatever the English was when the translator last opened the file.

import { promises as fs } from "fs";
import path from "path";
import { isTranslatableType, translatableEntriesForType } from "../../src/i18n/translatablePaths.js";
import { toSlug } from "../../src/utils/slug.js";

// Compendium folder names are translatable too, but a folder is not a document: it has no type and
// no system data. They ride through the same reconciliation under a reserved pseudo-type so that
// drift detection, the review markers and the authoring format all apply to them unchanged.
export const FOLDER_TYPE = "_folders";
export const FOLDER_SLUG = "_folders";

export class DuplicateKeyError extends Error {
	constructor(type, slug, key) {
		super(`Duplicate translation key "${key}" in ${type} "${slug}". Two rows share a slug — fix the pack source.`);
		this.name = "DuplicateKeyError";
		this.type = type;
		this.slug = slug;
		this.key  = key;
	}
}

/**
 * @param {object[]} documents  pack source documents, as committed
 * @returns {Map<string, Map<string, Map<string, string>>>} type → slug → key → English text
 */
export function englishCatalog(documents) {
	const byType = new Map();
	for (const doc of documents ?? []) {
		if (!isTranslatableType(doc?.type)) continue;
		const slug = doc.system?.slug;
		if (!slug) continue;

		const bySlug = byType.get(doc.type) ?? new Map();
		byType.set(doc.type, bySlug);
		const strings = bySlug.get(slug) ?? new Map();
		bySlug.set(slug, strings);

		for (const { key, text } of translatableEntriesForType(doc.type, doc)) {
			// A silent overwrite here would drop one of the two strings from the translator's file
			// and leave the sheet half-translated, so duplicate slugs must be a hard failure.
			if (strings.has(key)) throw new DuplicateKeyError(doc.type, slug, key);
			strings.set(key, text);
		}
	}
	return byType;
}

export async function readPackDocuments(packDir) {
	const documents = [];
	const entries = await fs.readdir(packDir, { withFileTypes: true, recursive: true });
	for (const entry of entries) {
		if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
		const parent = entry.parentPath ?? entry.path;
		if (path.basename(parent) === "_folders") continue;
		const full = path.join(parent, entry.name);
		try {
			documents.push(JSON.parse(await fs.readFile(full, "utf8")));
		} catch (cause) {
			throw new Error(`Failed parsing ${full}`, { cause });
		}
	}
	return documents.sort((a, b) => (a.system?.slug ?? "").localeCompare(b.system?.slug ?? ""));
}

/** Folder documents under a pack's `_folders/` directories, at any depth. */
export async function readPackFolders(packDir) {
	const folders = [];
	let entries;
	try {
		entries = await fs.readdir(packDir, { withFileTypes: true, recursive: true });
	} catch {
		return folders;
	}
	for (const entry of entries) {
		if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
		const parent = entry.parentPath ?? entry.path;
		if (path.basename(parent) !== "_folders") continue;
		const folder = JSON.parse(await fs.readFile(path.join(parent, entry.name), "utf8"));
		if (folder?.name) folders.push(folder);
	}
	return folders;
}

/** Key → English folder name. Keyed by the slugified name, since a folder carries no slug. */
export function folderCatalog(folders) {
	const byKey = new Map();
	for (const folder of folders ?? []) {
		if (folder?.name) byKey.set(toSlug(folder.name), folder.name);
	}
	return byKey;
}

/** Folds a pack's folders into a catalog so they reconcile alongside its documents. */
export function withFolders(catalog, folders) {
	if (folders?.size) catalog.set(FOLDER_TYPE, new Map([[FOLDER_SLUG, folders]]));
	return catalog;
}

export async function englishCatalogForPack(pack, root = ".") {
	const dir = path.join(root, "packs", "src", pack);
	const catalog = englishCatalog(await readPackDocuments(dir));
	return withFolders(catalog, folderCatalog(await readPackFolders(dir)));
}
