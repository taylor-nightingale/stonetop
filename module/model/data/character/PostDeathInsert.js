/**
 * Raw data for a post-death insert, read from the compendium document.
 * @property {string}   slug
 * @property {string}   name
 * @property {string|null} img
 * @property {string|null} description - trigger text ("When you die but...")
 * @property {object[]} instincts       - raw instinct option objects from flags.stonetop
 * @property {object[]} lore            - raw lore entry objects from flags.stonetop
 */
export class PostDeathInsert {
	constructor(doc) {
		const flags      = doc.flags?.stonetop ?? {};
		this.slug        = doc.system?.slug ?? "";
		this.name        = doc.name         ?? "";
		this.img         = doc.img          ?? null;
		this.description = doc.system?.description ?? null;
		this.instinct    = flags.instinct   ?? null;
		this.lore        = flags.lore       ?? [];
	}
}
