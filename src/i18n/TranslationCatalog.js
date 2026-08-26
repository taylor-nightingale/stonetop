import { KEY_SEPARATOR, isTranslatableType, translatableEntriesForType } from "./translatablePaths.js";

/**
 * The compendium prose for the active language, read off the loaded language file at i18nInit
 * exactly as TagGlossary and Advice are — no fetch, and no async race with the first sheet render.
 *
 * Documents stay English in `_source`; a translation is laid over the *prepared* data, so
 * `toObject()`, every pack write and every migration still see the English the packs were built
 * from. That is what lets a world switch language and get the other one, and it is why anything
 * copying compendium data onto an actor must copy source rather than prepared data.
 *
 * Shape, under `stonetop.compendium` in e.g. languages/de.json:
 *   { playbook: { "the-seeker": { "name": "Der Sucher", "backgrounds/patriot/label": "Patriot" } } }
 */
export class TranslationCatalog {
	_byType;

	constructor(byType = {}) {
		this._byType = byType;
	}

	static fromTranslations(node) {
		const byType = {};
		for (const [type, bySlug] of Object.entries(node ?? {})) {
			if (!isTranslatableType(type) || !bySlug || typeof bySlug !== "object") continue;
			const documents = {};
			for (const [slug, strings] of Object.entries(bySlug)) {
				if (!strings || typeof strings !== "object") continue;
				const kept = Object.entries(strings).filter(([, v]) => typeof v === "string" && v.trim());
				if (kept.length) documents[slug] = Object.fromEntries(kept);
			}
			if (Object.keys(documents).length) byType[type] = documents;
		}
		return new TranslationCatalog(byType);
	}

	get isEmpty() {
		return !Object.keys(this._byType).length;
	}

	/** The translated strings for one document, keyed as translatablePaths keys them. */
	stringsFor(type, slug) {
		if (!slug) return null;
		return this._byType[type]?.[slug] ?? null;
	}

	/**
	 * Lays this catalog's prose over a prepared document. Mutates, and is called from
	 * prepareBaseData, so it re-applies after every update rather than being written to source.
	 */
	applyTo(document) {
		if (this.isEmpty) return;
		const strings = this.stringsFor(document?.type, document?.system?.slug);
		if (!strings) return;

		for (const entry of translatableEntriesForType(document.type, document)) {
			const translated = strings[entry.key];
			if (translated) foundry.utils.setProperty(document, entry.path, translated);
		}
	}

	/**
	 * A compendium index entry with its name translated. Returns a copy: `pack.index` is core's, and
	 * a repository handing out one of its objects must not be able to rewrite it.
	 */
	localizedIndexEntry(entry) {
		if (this.isEmpty || !entry) return entry;
		const strings = this.stringsFor(entry.type, entry.system?.slug);
		const name    = strings?.name;
		return name ? { ...entry, name } : entry;
	}

	/** The catalog in force. Empty until the language file is read at i18nInit, so anything rendered
	 *  before then shows the English the packs ship with rather than failing. */
	static current = new TranslationCatalog();
}

export { KEY_SEPARATOR };
