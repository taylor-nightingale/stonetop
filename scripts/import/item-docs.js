// Turn the rows parsed off Book I's value tables (scripts/import/pdf/items.js) into the pack
// documents the reference page links to.
//
// Most Common-items rows ALREADY ship: packs/src/outfit-items holds the Inventory insert's gear
// (printed p. 142), which is a near-duplicate of the Common items table (printed pp. 94-95). The two
// lists name several of the same objects differently — the insert's "Mattock, iron and/or wood" is
// the table's "Mattock, iron" — so a row resolves against the existing items first and only becomes
// a NEW document when the book is genuinely printing something the pack doesn't have yet. Nothing
// here rewrites an item that already exists; a resolved row contributes only its id, so hand-authored
// weights, columns and slugs stay exactly as they are.

import { deterministicId, documentKey } from "./ids.js";
import { toSlug } from "../../src/utils/slug.js";

export const OUTFIT_PACK   = "outfit-items";
export const FOLLOWER_PACK = "followers";

/**
 * Rows the book prints as cross-references rather than as objects you could own — the bronze-weapons
 * section prices two whole CATEGORIES ("Common weapons (spears, daggers, etc.)", "Weapons of war
 * (see above)"). They belong on the reference page but there is nothing to make an item out of.
 */
export const CATEGORY_ROWS = new Set(["Common weapons", "Weapons of war"]);

/** Stamped on every document this build writes, so a rebuild can tell its own previous output (safe
 *  to replace) from the hand-authored items it must never touch. */
export const GENERATED = "book-items";
export const generatedFlags = () => ({ stonetop: { generated: GENERATED } });
export const isGenerated = (doc) => doc?.flags?.stonetop?.generated === GENERATED;

/**
 * Book-I rows whose object already ships under the Inventory insert's name for it. Keyed by the
 * value table's name → the insert's, both verbatim, so the pairing stays checkable against the book
 * rather than hiding inside a fuzzy match.
 */
export const INSERT_ALIASES = new Map([
	["Mattock, iron",               "Mattock, iron and/or wood"],
	["Extra oil, for lamp/lantern", "Extra oil"],
	["Bowstring, spare",            "Bowstring"],
	["Handful of copper coins",     "Handful of coppers"],
	["Sack",                        "Sack (empty)"],
	["Snowshoes",                   "Snow-shoes"],
]);

/** Compare printed names loosely enough to see through the two lists' punctuation and "and/or". */
export const normalizeName = (name) => String(name).toLowerCase()
	.replace(/\band\/or\b/g, " or ")
	.replace(/\bfeet\b/g, "ft")
	.replace(/[^a-z0-9]+/g, " ")
	.trim();

/** What a resolved row points at: an item that already ships, or one this build has to create. */
export class ResolvedRow {
	constructor(item, { id, pack, existing, kind }) {
		this.item     = item;      // the BookItem the table printed
		this.id       = id;        // null for a category row — nothing to link
		this.pack     = pack;
		this.existing = existing;  // true when the pack already had it
		this.kind     = kind;      // "outfitItem" | "follower" | "category"
	}

	get uuid() { return this.id ? `Compendium.stonetop.${this.pack}.Item.${this.id}` : null; }
}

const isLivestock = (section) => /livestock/i.test(section.title);

/**
 * Resolve one table row against the items already in the pack.
 *
 * `byName` maps a normalized item name → the existing document. Livestock rows become followers
 * (they are stat blocks, not gear); category rows resolve to nothing.
 */
export function resolveRow(item, section, byName) {
	if (CATEGORY_ROWS.has(item.name) && /bronze/i.test(section.title)) {
		return new ResolvedRow(item, { id: null, pack: null, existing: false, kind: "category" });
	}
	if (isLivestock(section)) {
		return new ResolvedRow(item, {
			id: deterministicId(FOLLOWER_PACK, followerSlug(item.name)), pack: FOLLOWER_PACK,
			existing: false, kind: "follower",
		});
	}
	const existing = byName.get(normalizeName(INSERT_ALIASES.get(item.name) ?? item.name));
	return new ResolvedRow(item, {
		id: existing?._id ?? deterministicId(OUTFIT_PACK, toSlug(item.name)),
		pack: OUTFIT_PACK, existing: !!existing, kind: "outfitItem",
	});
}

/** A livestock row's slug. The book's ", follower" / ", follower?" is a note about which pack the
 *  row belongs in, not part of the animal's name, so it never reaches the slug. */
export const followerSlug = (name) => toSlug(String(name).replace(/,\s*follower\??$/i, ""));

/** …and the same trim for the document name, so the compendium reads "Mule", not "Mule, follower?".
 *  The reference page still prints the row exactly as the book sets it. */
export const followerName = (name) => String(name).replace(/,\s*follower\??$/i, "").trim();

/**
 * Build an `outfitItem` document for a row the pack doesn't have yet.
 *
 * A row with no load diamond is a "small" item — it fits in a pocket, pouch or boot and costs no ◇ —
 * which the pack stores as weight 1 in the small column, the shape every hand-authored small item
 * already uses (the diamond count IS the weight for everything else).
 */
export function toOutfitItemDoc(item, { folder = null } = {}) {
	const slug = toSlug(item.name);
	const id   = deterministicId(OUTFIT_PACK, slug);
	return {
		_id: id,
		_key: documentKey("Item", id),
		name: item.name,
		type: "outfitItem",
		system: {
			slug,
			inventoryColumn: item.inventoryColumn,
			weight:          Math.max(1, item.weight),
			value:           item.value,
			note:            item.note,
			resource:        item.resource,
			twoCol:          false,
			armor:           item.armor,
			source:          null,
			tagList:         item.tagList,
		},
		flags: generatedFlags(),
		folder,
	};
}

/**
 * A Foundry folder document for one of the book's table sections.
 *
 * `key` is the folder's path within the pack source, because THAT is what identifies a folder here:
 * scripts/compendium-pack/pack.js derives the compendium's folder tree from the directory tree and
 * looks each one up as `<dir>/_folders/<dirname>.json`. Writing the doc there with the name we want
 * is what stops the packer minting its own, named after the directory ("weapons of war").
 */
export function toFolderDoc(name, { pack, parent = null, key = name } = {}) {
	const id = deterministicId(`${pack}-folders`, key);
	return {
		name,
		type: "Item",
		description: "",
		folder: parent,
		sorting: "a",
		sort: 0,
		color: null,
		flags: generatedFlags(),
		_id: id,
		_key: documentKey("Folder", id),
	};
}

/** Title-case a section heading the book sets in lower case ("weapons of war" → "Weapons of War"). */
export const sectionTitle = (title) => title.replace(/\*+$/, "").trim()
	.replace(/\b([a-z])(\w*)/g, (_, a, rest) => (/^(of|or|and|the|a)$/i.test(a + rest) ? a + rest : a.toUpperCase() + rest));
