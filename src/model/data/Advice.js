/**
 * Book I's "If you want to…" spread (pp. 98-101): for each thing a player might want more of, how
 * the book says to go about getting it. The text lives in `languages/en.json` under
 * `stonetop.advice` — it is prose a player reads, so a translator handles it alongside every other
 * string. Generated there by scripts/import/pdf/build-advice.js.
 *
 * A topic is addressed by the stable key the build script assigns ("fortunes", "coin", …), which is
 * what a sheet's ? button carries; the book's own heading is the `title`.
 */

/** A run of prose. */
export class AdviceParagraph {
	constructor(text) {
		this.type = "para";
		this.text = text;
	}

	static fromStored(raw) {
		return new AdviceParagraph(String(raw?.text ?? ""));
	}
}

/** A bulleted list of ways to go about it. */
export class AdviceList {
	constructor(items) {
		this.type  = "list";
		this.items = items;
	}

	static fromStored(raw) {
		return new AdviceList((raw?.items ?? []).filter(i => typeof i === "string"));
	}
}

const BLOCK_TYPES = { para: AdviceParagraph, list: AdviceList };

/** Parse a stored `blocks` array — the one shape the book's prose takes, shared by an advice topic
 *  and by a reference sidebar (src/model/data/Reference.js), so the two cannot drift. */
export function blocksFromStored(raw) {
	return (raw?.blocks ?? [])
		.map(b => BLOCK_TYPES[b?.type]?.fromStored(b))
		.filter(Boolean);
}

/** One topic: the heading the book prints, and the blocks under it. */
export class AdviceTopic {
	constructor(key, title, blocks = []) {
		this.key    = key;
		this.title  = title;
		this.blocks = blocks;
	}

	static fromStored(key, raw) {
		return new AdviceTopic(key, String(raw?.title ?? ""), blocksFromStored(raw));
	}
}

export const ADVICE_LABEL_KEY = "stonetop.sheet.advice.label";

/**
 * The one sentence that names a topic: "If you want to… improve Prosperity".
 *
 * The ? button's label and the title of the window it opens are the same words, so both are built
 * here from the book's own heading rather than each carrying its own copy — which is what keeps the
 * ten headings out of the language file a second time. Takes the formatter so the model stays clear
 * of Foundry; callers pass `game.i18n.format`.
 *
 * @param {AdviceTopic|null} topic
 * @returns {string} empty when there is no such topic — nothing to label, so nothing to render.
 */
export function adviceLabel(topic, format) {
	return topic ? format(ADVICE_LABEL_KEY, { topic: topic.title }) : "";
}

/**
 * The advice in force, looked up by topic key. A key with no entry is not an error — the language
 * file may predate a topic, and a sheet simply renders no ? button for it.
 */
export class Advice {
	/** @param {AdviceTopic[]} topics */
	constructor(topics = []) {
		this.byKey = new Map(topics.map(t => [t.key, t]));
	}

	/**
	 * Read the advice out of a localization tree — `game.i18n.translations.stonetop.advice`, shaped
	 * `{ [key]: { title, blocks } }`. Passed in rather than reached for, so a test can hand over its
	 * own tree.
	 */
	static fromTranslations(tree = {}) {
		return new Advice(Object.entries(tree ?? {}).map(([key, raw]) => AdviceTopic.fromStored(key, raw)));
	}

	/** @returns {AdviceTopic|null} */
	lookup(key) {
		return this.byKey.get(key) ?? null;
	}

	has(key) {
		return this.byKey.has(key);
	}

	get all() {
		return [...this.byKey.values()];
	}

	/**
	 * The advice in force. Empty until the language file is read at i18nInit, so a sheet rendered
	 * before then shows no ? buttons rather than failing.
	 */
	static current = new Advice();
}
