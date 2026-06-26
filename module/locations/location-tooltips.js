// Replaces the useless default "Journal Entry" hover tooltip on cross-links into
// the Stonetop journal pack with that entry's one-line summary.
//
// The summary is authored as a `flags.stonetop.summary` on each journal (by the
// gazetteer generators) and read here from the pack's compendium index — no
// documents are loaded. The index is built lazily and cached; render hooks
// (registered in stonetop.js) call applyLocationTooltips() on the rendered HTML.

// Packs that carry hover summaries. The locations, lore, and bestiary-codex
// generators all stamp `flags.stonetop.summary`; they now ship in one merged pack.
const SUMMARY_PACKS = ["stonetop.stonetop-journal"];

let _indexPromise = null;

/**
 * Build (or return the cached) Map<uuid, summary> across every summary pack.
 * Caches the promise so concurrent callers share one in-flight build. Call once
 * on ready to warm the cache so the first hover is instant.
 */
export function ensureLocationSummaryIndex() {
	return _indexPromise ??= (async () => {
		const map = new Map();
		for (const packId of SUMMARY_PACKS) await _indexPackSummaries(map, packId);
		// Also index world journals carrying the summary flag — e.g. the copies
		// seeded into the world on first load (SeedCompendiums.js), whose
		// cross-links are rewritten to world uuids and so wouldn't match the
		// compendium-keyed entries above.
		for (const entry of game.journal ?? []) {
			const summary = entry.flags?.stonetop?.summary;
			if (summary) map.set(entry.uuid, summary);
		}
		return map;
	})();
}

/** Drop the cached summary index so the next lookup rebuilds it — call after
 *  world journals carrying summaries are added (e.g. compendium seeding). */
export function invalidateLocationSummaryIndex() {
	_indexPromise = null;
}

/** Index every summarized entry of one compendium pack into `map`, keyed by uuid
 *  (falling back to a constructed Compendium uuid for indexes that omit it). */
async function _indexPackSummaries(map, packId) {
	const pack = globalThis.game?.packs?.get?.(packId);
	if (!pack) return;
	const index = await pack.getIndex({ fields: ["flags.stonetop.summary"] });
	for (const entry of index) {
		const summary = entry.flags?.stonetop?.summary;
		if (summary) map.set(entry.uuid ?? `Compendium.${pack.collection}.JournalEntry.${entry._id}`, summary);
	}
}

/**
 * Set data-tooltip = the entry summary on every content-link in `root` that
 * points at a summarized Stonetop journal. Safe to call repeatedly.
 * @param {HTMLElement|jQuery} root
 */
export async function applyLocationTooltips(root) {
	const el = root?.jquery ? root[0] : root;
	if (!el?.querySelectorAll) return;
	const links = el.querySelectorAll("a.content-link[data-uuid]");
	if (!links.length) return;

	const map = await ensureLocationSummaryIndex();
	for (const a of links) {
		const summary = map.get(a.dataset.uuid);
		if (summary) a.dataset.tooltip = summary;
	}
}
