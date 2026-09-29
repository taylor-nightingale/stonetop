import { sectionBodyId, moveBodyId } from "../../utils/regionIds.js";

/**
 * What has arrived on a character since a sheet last drew it, of a kind named by slug. The first draw
 * reports nothing: a sheet opening on a character is not anything arriving.
 */
export class Arrivals {
	#seen = null;

	/** Record this draw's slugs; return the ones new since the last draw. */
	newOf(slugs) {
		const fresh = this.#seen ? slugs.filter(slug => slug && !this.#seen.has(slug)) : [];
		this.#seen = new Set(slugs.filter(Boolean));
		return fresh;
	}
}

/**
 * The regions a sheet opens because something arrived (D11, D12): a playbook just chosen opens every
 * section of the Playbook tab; an insert just gained opens its sections and its moves' text — gaining
 * one is a small creation, and an insert gained by dying arrives at the worst moment with nothing
 * chosen. Every open sheet of the character notices for itself. On the sheet instance.
 */
export class ArrivalRegions {
	#playbook = new Arrivals();
	#inserts  = new Arrivals();

	/**
	 * @param {CharacterSnapshot} snapshot this draw's
	 * @param {string} prefix the sheet's id prefix
	 * @returns {string[]} region ids to open
	 */
	regionsFor(snapshot, prefix) {
		const ids = [];
		if (this.#playbook.newOf(snapshot.playbook ? [snapshot.playbook.slug] : []).length && snapshot.playbookSections)
			ids.push(...snapshot.playbookSections.keys.map(key => sectionBodyId(prefix, key)));
		const inserts = snapshot.inserts ?? [];
		for (const slug of this.#inserts.newOf(inserts.map(i => i.slug))) {
			const insert = inserts.find(i => i.slug === slug);
			ids.push(...insert.sections.keys.map(key => sectionBodyId(prefix, key)));
			ids.push(...(insert.moves ?? []).map(move => moveBodyId(prefix, `insert-${slug}`, move.slug)));
		}
		return ids;
	}
}
