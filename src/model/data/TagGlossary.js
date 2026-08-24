import { toSlug } from "../../utils/slug.js";

/**
 * One tag as Book I defines it. The definitions live in `languages/en.json` under
 * `stonetop.tagGlossary` — they are text a player reads, so a translator handles them alongside
 * every other string. Generated there by scripts/import/pdf/build-tag-glossary.js, which reads the
 * book's own typeface split, so mechanical modifiers ([n] armor, +[n] damage, hours, uses) never
 * land in here.
 *
 * `category` is "general", "range" or "artifact" — which sidebar the book prints it in, carried as
 * the nesting of the language file rather than as a string of its own. It is not a separate kind of
 * thing: a tag is a tag wherever it lands, on a spear, an arcanum or an NPC.
 */
export class TagDefinition {
	constructor(slug, definition, category) {
		this.slug       = slug;
		this.definition = definition;
		this.category   = category;
	}
}

/**
 * The definitions behind tag chips, looked up by the token as authored. The book says plainly that
 * "others are certainly possible", so an unknown token is not an error — it simply has no
 * definition, and renders as a plain tag.
 */
export class TagGlossary {
	/** @param {TagDefinition[]} definitions */
	constructor(definitions = []) {
		this.bySlug = new Map(definitions.map((d) => [d.slug, d]));
	}

	/**
	 * Read the glossary out of a localization tree — `game.i18n.translations.stonetop.tagGlossary`,
	 * shaped `{ [category]: { [slug]: definition } }`. Passed in rather than reached for, so a test
	 * can hand over its own tree.
	 */
	static fromTranslations(tree = {}) {
		const definitions = Object.entries(tree).flatMap(([category, entries]) =>
			Object.entries(entries ?? {})
				.filter(([, definition]) => typeof definition === "string" && definition.trim())
				.map(([slug, definition]) => new TagDefinition(slug, definition, category)));
		return new TagGlossary(definitions);
	}

	/** @returns {TagDefinition|null} */
	lookup(token) {
		return this.bySlug.get(toSlug(token)) ?? null;
	}

	get all() {
		return [...this.bySlug.values()];
	}

	/** Suggested options for a tag picker, in book order. */
	get labels() {
		return this.all.map((d) => d.slug);
	}

	/**
	 * The glossary in force. Empty until the language file is read at i18nInit, so a sheet rendered
	 * before then shows its tags with no definitions rather than failing.
	 */
	static current = new TagGlossary();
}
