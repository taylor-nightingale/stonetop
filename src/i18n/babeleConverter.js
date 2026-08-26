import { translatableEntriesForType } from "./translatablePaths.js";

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
// at `path`, `translation` is the entry's `stonetop` fragment, and the return value replaces `path`.
export function stonetopStringsConverter(value, translation, source) {
	if (!translation || typeof translation !== "object") return undefined;
	if (!value || typeof value !== "object") return undefined;

	// Babele reconstructs the document from what converters return, so the source data it handed us
	// must not be mutated — a compendium read is not the only thing holding a reference to it.
	const document = { ...source, system: foundry.utils.deepClone(value) };

	for (const entry of translatableEntriesForType(source?.type, document)) {
		// `name` is mapped separately, by Babele's own primitive converter.
		if (!entry.path.startsWith("system.")) continue;
		const translated = translation[entry.key];
		if (typeof translated === "string" && translated.trim()) {
			foundry.utils.setProperty(document, entry.path, translated);
		}
	}
	return document.system;
}

export const CONVERTER_NAME = "stonetopStrings";

/** The mapping block every generated translation file carries. */
export function stonetopMapping() {
	return {
		name: "name",
		stonetop: { path: "system", converter: CONVERTER_NAME },
	};
}
