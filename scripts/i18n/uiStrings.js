// The UI side of a translation: everything in `languages/<lang>.json`.
//
// These are the sheet's own words — tab names, section headings, button labels, the stat names down
// the side of a steading — as opposed to the book's words, which live in the packs and are handled
// by Babele. Both are translation work; only one of them had any tooling.
//
// That asymmetry is why a translated world still read "Resources", "Prosperity" and "Notes" in
// English: the 1.6.0 steading rework added ~200 keys to `en.json`, nothing compared the two files,
// and a key missing from `de.json` simply falls back to English at runtime — correct, silent, and
// invisible to the person whose job it is to translate it.
//
// Reconciled through the very same `reconcile()` every pack goes through, so the report a translator
// already reads gains one more line rather than a second vocabulary. The catalog is shaped the way
// reconcile consumes it (type → slug → key → English), exactly as tagLabels does it.
//
// One thing it cannot do that the packs can: notice DRIFT. Flagging a translation as stale needs the
// English it was written against, and a language file stores only the translated string. Giving UI
// strings an authoring file under `languages/compendium/<lang>/` — the way the packs and tag labels
// have one — is what would close that, and would make `languages/<lang>.json` generated output like
// every other shipped translation. Until then a UI string is either present or missing, never stale.
import { EntryStatus, reconcile } from "./reconcile.js";
import { languageFilePath, readJson } from "./files.js";

/** The pack name this reports under, so it reads as `de/ui` beside `de/moves`. */
export const UI_PACK = "ui";
// A single pseudo-document: the language file is one flat namespace, not a set of documents.
export const UI_TYPE = "_ui";
export const UI_SLUG = "_ui";

// `stonetop.tagLabels` is GENERATED into the language file by buildBabele from the tag authoring
// file. It is translation work, but it is already reported as `de/tag-labels`; counting it here too
// would double it, and — since `en.json` deliberately carries none — would report all 208 German tag
// labels as orphans.
const GENERATED = "stonetop.tagLabels.";

/**
 * A language file flattened to dotted keys — the addresses `game.i18n.localize` is called with.
 *
 * Both files are pure trees of strings, so anything that is not a string is a structural mistake in
 * the file rather than something to translate, and is left out rather than reported as missing.
 */
export function flattenStrings(tree, prefix = "") {
	const out = new Map();
	for (const [key, value] of Object.entries(tree ?? {})) {
		const address = prefix ? `${prefix}.${key}` : key;
		if (typeof value === "string") {
			if (!address.startsWith(GENERATED)) out.set(address, value);
			continue;
		}
		if (value && typeof value === "object" && !Array.isArray(value)) {
			for (const [nested, text] of flattenStrings(value, address)) out.set(nested, text);
		}
	}
	return out;
}

/** The English side, in the shape reconcile() consumes. */
export function uiEnglishCatalog(english) {
	return new Map([[UI_TYPE, new Map([[UI_SLUG, english]])]]);
}

/**
 * The translator's side, in the shape reconcile() consumes.
 *
 * `source` is set to the CURRENT English, which is what makes every present translation read as
 * translated rather than as drift — see the note on drift above. A key the English no longer has
 * carries no source and falls through to reconcile's orphan handling, which is the one piece of
 * drift a language file can still prove.
 */
export function uiAuthoring(english, translated) {
	const entries = {};
	for (const [key, text] of translated) {
		entries[key] = { source: english.get(key), text };
	}
	return { [UI_SLUG]: entries };
}

/** The UI strings of one language, reconciled through the same machinery as every pack. */
export async function reconcileUiStrings(lang, root = ".") {
	const english    = flattenStrings(await readJson(languageFilePath("en", root), {}));
	const translated = flattenStrings(await readJson(languageFilePath(lang, root), {}));
	return reconcile(lang, UI_PACK, uiEnglishCatalog(english), uiAuthoring(english, translated));
}

/**
 * The keys a translator still has to write, and where to write them.
 *
 * A separate section of the handoff rather than an ordinary HandoffItem, because it answers a
 * different question. A pack's untranslated strings need no worklist: `i18n:extract` has already
 * written every one of them into the authoring file with an empty `text`, so the file IS the
 * worklist. A language file has no such slots — a missing key is simply absent — so the only place
 * the work can be seen is here.
 */
export class UiStringWorklist {
	constructor(lang, entries = []) {
		this.lang    = lang;
		this.entries = entries;
	}

	static from(lang, reconciliation) {
		return new UiStringWorklist(lang, reconciliation
			.entriesWith(EntryStatus.UNTRANSLATED)
			.map(({ entry }) => ({ key: entry.key, english: entry.source })));
	}

	get size() {
		return this.entries.length;
	}

	get summaryLine() {
		return `- **${this.size}** interface strings with no translation yet, listed at the end`;
	}

	get file() {
		return `languages/${this.lang}.json`;
	}

	toMarkdown() {
		if (!this.size) return "";
		const lines = [
			`## ${this.file}`,
			"",
			"The sheet's own words — headings, tab names, button labels — as opposed to the book's,",
			"which are in the pack files above. These are edited directly in the language file, not",
			"under `languages/compendium/`, and a missing key falls back to English at runtime, which",
			"is why they can go unnoticed.",
			"",
			"The key is the full dotted path; create the nesting it names. Leave a key out rather than",
			"copying the English in — an English placeholder reads as finished work, and the fallback",
			"already shows English.",
			"",
		];
		// Grouped by their parent path, so a translator sees one section of the sheet at a time
		// rather than an alphabetical list that jumps between tabs.
		for (const [group, entries] of this.byGroup()) {
			lines.push(`### \`${group}\``, "");
			for (const { key, english } of entries) lines.push(`- \`"${key}"\` — ${JSON.stringify(english)}`);
			lines.push("");
		}
		return lines.join("\n");
	}

	/** Parent path → entries, first appearance wins, so the order follows `en.json` itself. */
	byGroup() {
		const groups = new Map();
		for (const entry of this.entries) {
			const dot   = entry.key.lastIndexOf(".");
			const group = dot < 0 ? entry.key : entry.key.slice(0, dot);
			if (!groups.has(group)) groups.set(group, []);
			groups.get(group).push(entry);
		}
		return groups;
	}
}
