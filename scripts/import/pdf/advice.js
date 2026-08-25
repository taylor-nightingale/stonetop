// Parse Book I's "If you want to…" spread (pp. 98-101) into the per-topic advice the sheets show
// behind their ? buttons. The spread is ten h2 sections of plain prose and swirl-bulleted lists —
// no tables, stat blocks or art — so this reads the extractArticle() document straight through in
// column order and needs nothing from the PDF or Foundry. Pure, so tests drive it with a
// hand-built document (tests/import/pdf/advice.test.js).
//
// Text comes out as markdown rather than HTML because it is destined for languages/en.json, where a
// translator handles it alongside every other player-facing string — see src/model/data/Advice.js,
// which reads it back.
import { joinLines, MARKDOWN_EMPHASIS } from "./render-html.js";
import { toSlug } from "../../../src/utils/slug.js";

/**
 * The ten topics, keyed by the stable slug the sheets ask for. The book's own heading is matched
 * rather than slugified, so a reprint that rewords one fails the build loudly instead of silently
 * renaming a key every ? button already points at.
 */
export const ADVICE_TOPICS = [
	{ key: "fortunes",             match: /^increase Fortunes$/i },
	{ key: "surplus",              match: /^gain Surplus$/i },
	{ key: "defenses",             match: /^improve Defenses$/i },
	{ key: "population",           match: /^increase Population$/i },
	{ key: "prosperity",           match: /^improve Prosperity$/i },
	{ key: "steadingImprovement",  match: /^unlock a steading improvement$/i },
	{ key: "coin",                 match: /^get some coin$/i },
	{ key: "arcana",               match: /^find new arcana$/i },
	{ key: "arcanumMystery",       match: /^unlock the mysteries of an arcanum$/i },
	{ key: "followers",            match: /^recruit followers$/i },
];

/** A cited name is bold in the book; the whole bold run is the name. */
const BOLD_RUN = /\*\*([^*]+)\*\*/g;

/** Strip the heading's leading ellipsis ("… gain Surplus", "…improve Defenses"). */
const headingText = (raw) => String(raw).replace(/^\s*(?:…|\.\.\.)\s*/, "").trim();

/** A bullet glyph the vector layer couldn't carry, left at the head of an item's text. */
const stripBullet = (text) => text.replace(/^(?:[•◦‣▪ä]\s*)/, "");

/** The book breaks a cited name across a line end, which renders as two adjacent bold runs
 *  ("**Trade &** **Barter**"). Nothing in this spread sets two different names side by side, so
 *  rejoining every such pair restores the name — and lets it match the pack index. */
const rejoinSplitNames = (text) => text.replace(/\*\*(\s+)\*\*/g, "$1");

const md = (lines) => rejoinSplitNames(joinLines(lines, MARKDOWN_EMPHASIS));

/** One bold name → a content link, when the pack index knows it. Names the index doesn't carry
 *  (`Persuade`, `Seasons Change` — each split across several documents) stay bold prose. */
function linkNames(text, uuids) {
	return text.replace(BOLD_RUN, (whole, name) => {
		const uuid = uuids.get(toSlug(name));
		return uuid ? `@UUID[${uuid}]{${name}}` : whole;
	});
}

/** A run of prose. */
export class AdviceParagraph {
	constructor(text) {
		this.type = "para";
		this.text = text;
	}

	withReferences(uuids) {
		return new AdviceParagraph(linkNames(this.text, uuids));
	}
}

/** A swirl-bulleted list of options. */
export class AdviceList {
	constructor(items) {
		this.type  = "list";
		this.items = items;
	}

	withReferences(uuids) {
		return new AdviceList(this.items.map((i) => linkNames(i, uuids)));
	}
}

/** One "… do this" section: the heading the book prints, and the blocks under it. */
export class AdviceTopic {
	constructor(key, title, blocks = []) {
		this.key    = key;
		this.title  = title;
		this.blocks = blocks;
	}

	withReferences(uuids) {
		return new AdviceTopic(this.key, this.title, this.blocks.map((b) => b.withReferences(uuids)));
	}

	/** The shape written to the language file — the key is where it hangs, not part of the value. */
	toTranslation() {
		return { title: this.title, blocks: this.blocks };
	}
}

/** The whole spread: the ten topics, in book order. */
export class AdviceDocument {
	constructor(topics) {
		this.topics = topics;
	}

	withReferences(uuids) {
		return new AdviceDocument(this.topics.map((t) => t.withReferences(uuids)));
	}

	/** `{ [key]: { title, blocks } }`, as `stonetop.advice` holds it. */
	toTranslation() {
		const topics = {};
		for (const topic of this.topics) topics[topic.key] = topic.toTranslation();
		return topics;
	}
}

/** Every column of every section, in the order the spread is read. */
function* columnBlocks(article) {
	for (const section of article.sections ?? [])
		for (const side of ["left", "right"])
			for (const column of section[side] ?? [])
				yield* column.blocks ?? [];
}

/**
 * Read the extracted article into an AdviceDocument. Throws when a heading isn't one of the ten
 * known topics, or when one of them never turned up — a silent partial page would leave a ? button
 * opening an empty window.
 */
export function parseAdvice(article) {
	const topics = [];
	let current = null;

	for (const block of columnBlocks(article)) {
		if (block.type === "heading" && block.level === "h2") {
			const title = headingText(block.line.text);
			const topic = ADVICE_TOPICS.find((t) => t.match.test(title));
			if (!topic) throw new Error(`"If you want to…": unrecognized topic heading "${title}"`);
			current = new AdviceTopic(topic.key, title);
			topics.push(current);
			continue;
		}
		// Prose above the first heading is the spread's own lead-in, not advice about anything.
		if (block.type === "para" && current) {
			current.blocks.push(new AdviceParagraph(md(block.lines)));
			continue;
		}
		if (block.type === "list" && current) {
			current.blocks.push(new AdviceList(block.items.map((lines) => stripBullet(md(lines)))));
		}
	}

	const missing = ADVICE_TOPICS.filter((t) => !topics.some((p) => p.key === t.key));
	if (missing.length) {
		throw new Error(`"If you want to…": no section found for ${missing.map((t) => t.key).join(", ")}`);
	}
	return new AdviceDocument(topics);
}
