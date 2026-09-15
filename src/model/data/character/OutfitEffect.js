/**
 * What a move a character has taken does to one piece of their gear.
 *
 * The Armored move is the whole of it in the book: carry a shield and you "mark only ◆ (instead of
 * ◆◆)", and you "can ignore the *cumbersome* tag on any armor you wear". Both are statements about
 * gear, not about the move, so they are applied where the gear is resolved rather than read out of a
 * description at render time.
 *
 * The move carries the STRUCTURE (which slug, what changes); the words stay in its description,
 * which is where the book prints them and where a player reads them.
 */
export class OutfitEffect {
	/** One authored `system.outfitEffects` entry. Null when it names no gear, which is the only way an
	 *  entry can be meaningless — there is nothing to apply it to. */
	static fromData(data) {
		if (!data?.slug) return null;
		return new OutfitEffect(data.slug, data.weight ?? null, data.removeTags ?? []);
	}

	constructor(slug, weight = null, removeTags = []) {
		this.slug       = slug;
		this.weight     = weight;
		this.removeTags = removeTags;
	}

	appliesTo(item) {
		return item?.slug === this.slug;
	}

	/** The item as this effect leaves it — the item itself, untouched, when it says nothing about it. */
	applyTo(item) {
		if (!this.appliesTo(item)) return item;
		let changed = this.weight == null ? item : item.withWeight(this.weight);
		for (const tag of this.removeTags) changed = changed.withoutTag(tag);
		return changed;
	}
}

/** Every effect one character's taken moves declare, applied as one. */
export class OutfitEffects {
	static none() {
		return new OutfitEffects([]);
	}

	/** @param {object[]} entries authored `system.outfitEffects` entries, in the order their moves came */
	static from(entries = []) {
		return new OutfitEffects(entries.map(e => OutfitEffect.fromData(e)).filter(Boolean));
	}

	constructor(effects) {
		this.effects = effects;
	}

	get isEmpty() {
		return this.effects.length === 0;
	}

	apply(item) {
		return this.effects.reduce((changed, effect) => effect.applyTo(changed), item);
	}

	applyAll(items) {
		return this.isEmpty ? items : items.map(item => this.apply(item));
	}

	/** slug → gear, as this character carries it. A fresh map: the repository's own is shared. */
	applyToCatalog(catalog) {
		if (this.isEmpty) return catalog;
		return new Map([...catalog].map(([slug, item]) => [slug, this.apply(item)]));
	}
}
