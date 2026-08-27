// The tag side of a translation.
//
// A tag token is its own identity AND its own label, so it cannot be translated in place — see
// src/model/data/TagLabels.js. It is collected here from every pack, translated once, and shipped
// as ordinary localized strings in `languages/<lang>.json` under `stonetop.tagLabels`, which the
// system reads at i18nInit exactly as it reads the tag glossary.
//
// Gathered across ALL packs rather than per pack: `close` appears on dozens of possessions and
// hundreds of NPCs, and a translator should see it once.
import path from "path";
import { promises as fs } from "fs";
import { toSlug } from "../../src/utils/slug.js";
import { reconcile } from "./reconcile.js";
import { readAuthoring } from "./files.js";

// Every field that holds tag tokens. `companion.catalog[].options[]` and `defaults[]` are tags too —
// they render as tag chips on a companion.
const TAG_FIELDS = new Set(["tagList", "tagOptions", "options", "defaults"]);

export const TAG_TYPE = "_tags";
export const TAG_SLUG = "_tags";
export const TAG_PACK = "tag-labels";

// `options` is only tags inside a companion catalog entry; elsewhere it is a choice-group pick list.
function collectFrom(node, out, inCompanionCatalog = false) {
	if (Array.isArray(node)) {
		for (const element of node) collectFrom(element, out, inCompanionCatalog);
		return;
	}
	if (!node || typeof node !== "object") return;

	for (const [key, value] of Object.entries(node)) {
		const isTagField = key === "options" || key === "defaults"
			? inCompanionCatalog
			: TAG_FIELDS.has(key);
		if (isTagField && Array.isArray(value)) {
			for (const token of value) if (typeof token === "string" && token.trim()) out.add(token.trim());
			continue;
		}
		collectFrom(value, out, inCompanionCatalog || key === "catalog");
	}
}

/** Every distinct tag token in the packs, in a stable order. */
export function tagTokens(documents) {
	const found = new Set();
	for (const document of documents ?? []) collectFrom(document, found);
	return [...found].sort((a, b) => a.localeCompare(b));
}

/** token → itself. The English "translation" of a tag IS the token, which is why en.json needs none. */
export function tagCatalog(tokens) {
	return new Map(tokens.map(token => [toSlug(token), token]));
}

export async function readAllPackDocuments(root = ".") {
	const packsRoot = path.join(root, "packs", "src");
	const documents = [];
	const entries = await fs.readdir(packsRoot, { withFileTypes: true, recursive: true });
	for (const entry of entries) {
		if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
		const parent = entry.parentPath ?? entry.path;
		if (path.basename(parent) === "_folders") continue;
		documents.push(JSON.parse(await fs.readFile(path.join(parent, entry.name), "utf8")));
	}
	return documents;
}

/** The English side of the tag translation, in the shape reconcile() consumes. */
export async function tagEnglishCatalog(root = ".") {
	return new Map([[TAG_TYPE, new Map([[TAG_SLUG, tagCatalog(tagTokens(await readAllPackDocuments(root)))]])]]);
}

/** `stonetop.tagLabels` for the language file: slugified token → translated label. */
export function tagLabelsFor(runtime) {
	return runtime[TAG_TYPE]?.[TAG_SLUG] ?? {};
}

/** Tags reconciled for one language, through the same machinery as every pack. */
export async function reconcileTagLabels(lang, root = ".") {
	const english = await tagEnglishCatalog(root);
	return reconcile(lang, TAG_PACK, english, await readAuthoring(lang, TAG_PACK, root));
}
