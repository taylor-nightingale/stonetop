import { FoundryPackStore } from "../../actors/character/repositories/FoundryPackStore.js";

/**
 * Where a sheet's ? button sends you: the page of Book I's "If you want to…" article that answers
 * for the thing you asked about.
 *
 * The article is a journal entry in the `reference` pack, built by scripts/import/build-book-one.js
 * with one page per topic, each stamped `flags.stonetop.topic` with the key the button carries. The
 * entry is found by its own `flags.stonetop.slug` rather than by an id spelled into the code, so a
 * rebuild cannot orphan a button.
 *
 * A real journal sheet, not a dialog: it is resizable, it remembers its size, and its sidebar lists
 * the other nine topics to read next.
 */
export const REFERENCE_PACK = "stonetop.reference";
export const TOPICS_SLUG    = "if-you-want-to";

export class ReferenceTopics {
	/** @param {FoundryPackStore} store indexed on the entry flag this looks up by */
	constructor(store = new FoundryPackStore(REFERENCE_PACK, ["flags.stonetop.slug"])) {
		this._store = store;
	}

	/** The "If you want to…" entry, or null when the pack isn't installed. */
	async entry() {
		const found = await this._store.findEntry((e) => e?.flags?.stonetop?.slug === TOPICS_SLUG);
		return found ? this._store.getDocument(found._id) : null;
	}

	/**
	 * Open the article at one topic.
	 *
	 * The spread is one page you scroll, as the book sets it, so the topic is reached by its heading
	 * ANCHOR rather than by being a page of its own. The entry carries key → anchor, stamped by the
	 * build from the heading it actually rendered — so nothing here has to guess how a heading slugs.
	 *
	 * Resolves false when the pack, the entry or the topic is absent: a button for something the book
	 * doesn't cover is a no-op, not an error.
	 */
	async open(key) {
		if (!key) return false;
		const entry = await this.entry();
		const page = entry?.pages?.contents?.[0] ?? entry?.pages?.[0];
		if (!page) return false;
		const anchor = entry.flags?.stonetop?.topics?.[key];
		if (!anchor) return false;
		entry.sheet.render(true, { pageId: page.id, anchor });
		return true;
	}
}
