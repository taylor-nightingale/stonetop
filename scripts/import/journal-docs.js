// The shape of a JournalEntry and its pages in a compendium source, in one place.
//
// Both journal builders write the same documents — Book II's articles (pdf/build-journal.js) and
// Book I's reference articles (build-book-one.js) — and a page in particular has a `_key` the
// Foundry CLI depends on (`!journal.pages!<entryId>.<pageId>`; the parent stores only the page id),
// which is not the kind of detail two builders should each remember.

import { deterministicId, documentKey } from "./ids.js";

/**
 * A text JournalEntryPage embedded in `entryId`.
 *
 * `pageKey` names the page within its entry — the id is derived from it, so a rebuild produces the
 * same page and any link into it keeps resolving. An entry with one page conventionally uses
 * `<slug>#page`; an entry with several uses one key per page.
 */
export function textPage(pack, entryId, pageKey, name, content, { flags = {}, sort = 0 } = {}) {
	const id = deterministicId(pack, pageKey);
	return {
		_id: id,
		_key: `!journal.pages!${entryId}.${id}`,
		name,
		type: "text",
		title: { show: false, level: 1 },
		image: {},
		src: null,
		text: { format: 1, content, markdown: undefined },
		video: { controls: true, volume: 0.5 },
		system: {},
		sort,
		// -1 is INHERIT: a page follows its entry rather than carrying its own answer.
		ownership: { default: -1 },
		flags,
	};
}

/**
 * A JournalEntry document for a pack source. `pages` are built with `textPage` against the same
 * `pack` and this entry's id, which `entryId` hands back so a caller can build them first.
 */
export function journalEntry(pack, slug, { name, pages, sort = 0, ownership = 0, flags = {} }) {
	const id = entryId(pack, slug);
	return {
		_id: id,
		_key: documentKey("JournalEntry", id),
		name,
		pages,
		folder: null,
		sort,
		ownership: { default: ownership },
		flags,
	};
}

/** The id an entry will have, so its pages can be built before it. */
export const entryId = (pack, slug) => deterministicId(pack, slug);
