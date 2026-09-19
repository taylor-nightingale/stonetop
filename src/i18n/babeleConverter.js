import { translatableEntriesForType } from "./translatablePaths.js";

const SYSTEM_PREFIX = "system.";

// The Babele converter for everything under `system`.
//
// Babele's own `structured` converter matches array elements BY INDEX, and our choice groups are
// arrays of groups holding arrays of rows holding arrays of options. The PDF builders reorder those
// rows whenever the book is re-parsed, which would silently slide every translation below the change
// onto the wrong string. So `system` is handed to this converter whole and addressed the way the
// rest of the pipeline addresses it: by the slugs in the data.
//
// Registered at `babele.init` and named in each generated translation file's mapping block:
//   "stonetop": { "path": "system", "converter": "stonetopStrings" }
//
// Babele calls converters as (value, translation, source, ...), where `value` is the document data
// at `path`, `translation` is the entry's `stonetop` fragment, and the return value is MERGED over
// `path` — both for a compendium document and, through Babele's actor-item translation, for an
// embedded copy of one on a character or steading.
//
// Which is why only the subtrees actually translated are returned, never the whole of `system`.
// An embedded item carries the player's own state in the same object as the pack's prose —
// `acquired`, `categoryKey` and `instanceCount` on a move, `selected` and `playbookSlug` on a
// possession, `owned` and current `hp` on a follower, `backgroundValues` on a playbook — and none of
// it exists on the compendium document the translation is read from. Handing back a full clone of
// that document's `system` therefore wrote the pack's blank initials over every one of those fields:
// followers un-owned and at 0 HP, possessions deselected (and with them the outfit gear
// `outfitGrantFor` gates on `system.selected`), and every move orphaned from its category, which is
// what made the Moves tab and Seasons Change vanish from a translated steading.
//
// Nothing here has to know which fields those are. They are absent from TEXT_PATHS by construction —
// it is an allowlist of prose — so naming only what was translated excludes them all, and a field
// added to a data model later is excluded the same way without a line changing here.
export function stonetopStringsConverter(value, translation, source) {
	if (!translation || typeof translation !== "object") return undefined;
	if (!value || typeof value !== "object") return undefined;

	// Babele reconstructs the document from what converters return, so the source data it handed us
	// must not be mutated — a compendium read is not the only thing holding a reference to it.
	const document = { ...source, system: foundry.utils.deepClone(value) };
	const touched  = new Set();

	for (const entry of translatableEntriesForType(source?.type, document)) {
		// `name` is mapped separately, by Babele's own primitive converter.
		if (!entry.path.startsWith(SYSTEM_PREFIX)) continue;
		const translated = translation[entry.key];
		if (typeof translated === "string" && translated.trim()) {
			foundry.utils.setProperty(document, entry.path, translated);
			touched.add(entry.mergePath);
		}
	}

	// Undefined, not an empty object: Babele reads it as "nothing to merge" and leaves the English
	// standing, where `{}` would count as a translation and stamp the document as translated.
	if (!touched.size) return undefined;

	const system = {};
	for (const path of touched) {
		foundry.utils.setProperty(system, path.slice(SYSTEM_PREFIX.length),
			foundry.utils.getProperty(document, path));
	}
	return system;
}

export const CONVERTER_NAME = "stonetopStrings";

/** The mapping block every generated translation file carries. */
export function stonetopMapping() {
	return {
		name: "name",
		stonetop: { path: "system", converter: CONVERTER_NAME },
	};
}
