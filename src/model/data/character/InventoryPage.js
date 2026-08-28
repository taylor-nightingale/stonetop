/**
 * The shape of a printed inventory page: which gear it lists, in which column, in what order, split
 * into the groups the page sets off with whitespace.
 *
 * This is the PAGE, not the gear. What a piece of gear IS — its tags, note, weight, value, resource,
 * armor — lives on the `outfitItem` documents in the compendium. Those are a catalog, and their
 * folders are shelving for a human browsing it; nothing about where an item is filed decides whether
 * or where a sheet draws it. The page decides that, and the page says so in one place.
 *
 * Order is array position, so moving a row is moving a line. Nothing carries a rank, which is what
 * went wrong before: order is the one layout fact that cannot be stored on an item document, because
 * it is relational — and once it could not go there, neither could anything else honestly.
 *
 * The instance for Book I p. 142 is `inventoryInsertPage.js`.
 */
export class InventoryPage {
	constructor(columns) {
		this.columns = columns;
	}

	/** The column with this key ("regular" | "small"), or null. */
	column(key) {
		return this.columns.find(c => c.key === key) ?? null;
	}

	/** Every slug the page lists, in printed order. What a sheet draws, and nothing else. */
	get slugs() {
		return this.columns.flatMap(c => c.slugs);
	}
}

/** One of the page's checklists — the load ◇ column, or the small □ column beside it. */
export class InventoryColumn {
	constructor(key, sections) {
		this.key      = key;
		this.sections = sections;
	}

	get slugs() {
		return this.sections.flatMap(s => s.slugs);
	}
}

/**
 * One divider-delimited group of the page — the whitespace breaks the insert sets between its
 * supplies, its travel gear, its weapons — and optionally the line of prose printed under it.
 *
 * `lines` describes the page as it reads: each entry is one printed line, either a slug on its own
 * or a pair of slugs the page sets two-across ("Blanket | Change of clothes"). Layout is therefore
 * something the page states, not a flag repeated on every item that happens to be in a pair.
 */
export class PageSection {
	/** @param {(string|string[])[]} lines @param {{note?: string|null}} [options] note = an i18n key */
	constructor(lines, { note = null } = {}) {
		this.lines = lines;
		this.note  = note;
	}

	get slugs() {
		return this.lines.flat();
	}

	/**
	 * The section's lines grouped into layout runs: consecutive two-across lines become one grid,
	 * everything else a plain list. This is the shape the renderer needs, and it falls out of the
	 * page's own structure rather than being re-derived by scanning a flag on each item.
	 */
	get runs() {
		const runs = [];
		for (const line of this.lines) {
			const twoAcross = Array.isArray(line);
			const last      = runs.at(-1);
			if (last && last.twoAcross === twoAcross) last.slugs.push(...[line].flat());
			else runs.push(new PageRun(twoAcross, [line].flat()));
		}
		return runs;
	}
}

/** A stretch of one section set the same way: a plain run of rows, or a two-across grid. */
export class PageRun {
	constructor(twoAcross, slugs) {
		this.twoAcross = twoAcross;
		this.slugs     = slugs;
	}
}
