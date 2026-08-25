import { rich } from "./RichText.js";
import { AdviceParagraph, AdviceList } from "../data/Advice.js";

// Render shape for one "If you want to…" topic. The stored text is markdown carrying @UUID links to
// the moves and improvements the book cites by name, so every string is wrapped as RichText — the
// dialog runs the shared enrich pass over the snapshot, which is what makes those links clickable.

export class AdviceParagraphSnapshot {
	constructor(text) {
		this.type = "para";
		this.text = text;
	}
}

export class AdviceListSnapshot {
	constructor(items) {
		this.type  = "list";
		this.items = items;
	}
}

const BLOCK_BUILDERS = new Map([
	[AdviceParagraph, block => new AdviceParagraphSnapshot(rich(block.text))],
	[AdviceList,      block => new AdviceListSnapshot(block.items.map(i => rich(i)))],
]);

export class AdviceSnapshot {
	constructor(key, title, blocks) {
		this.key    = key;
		this.title  = title;
		this.blocks = blocks;
	}

	/** @param {import("../data/Advice.js").AdviceTopic} topic */
	static of(topic) {
		const blocks = topic.blocks.map(b => BLOCK_BUILDERS.get(b.constructor)?.(b)).filter(Boolean);
		return new AdviceSnapshot(topic.key, topic.title, blocks);
	}
}

/**
 * Render shape for a reference sidebar. Identical blocks to an advice topic — it is the same kind of
 * book prose — so it reuses the block builders and the same partial renders both.
 */
export class ReferenceSnapshot {
	constructor(key, title, blocks) {
		this.key    = key;
		this.title  = title;
		this.blocks = blocks;
	}

	/** @param {import("../data/Reference.js").ReferenceSidebar} sidebar */
	static of(sidebar) {
		const blocks = sidebar.blocks.map(b => BLOCK_BUILDERS.get(b.constructor)?.(b)).filter(Boolean);
		return new ReferenceSnapshot(sidebar.key, sidebar.title, blocks);
	}
}
