import { toSlug } from "../../utils/slug.js";

/**
 * One item a source wants to exist on an actor, and the full set of them.
 *
 * A grant is a *source* ("who says this item should be here" — `playbook:the-heavy`, `arcana:the-ring`)
 * plus a *key* (which thing it is — `move:bulwark`). Both travel with the item as a stamp, so the actor
 * can answer "which items exist because of X?" — the question that nothing could answer while five
 * different provenance markers were in use. Applying a set is a diff, never a rebuild: an item that is
 * still wanted is left exactly as it is, which is what keeps a player's acquired moves and a follower's
 * loyalty alive across a re-grant.
 *
 * Identity is (source, key), not global: a playbook's Bulwark and a hand-added Bulwark are two items on
 * purpose, and authored items carry no stamp at all.
 */
export class ItemGrant {
	constructor(itemData) {
		this.itemData = itemData;
		this.key      = ItemGrant.keyOf(itemData);
	}

	/** What an item IS — type + slug, the identity every find-by-slug in the sheet already uses. A grant
	 *  and an item on the actor are keyed the same way, which is how a grant can tell that the character
	 *  already has this thing. */
	static keyOf(item) {
		if (!item?.type) return null;
		const slug = item.system?.slug ?? toSlug(item.name ?? "");
		return slug ? `${item.type}:${slug}` : null;
	}

	/** The embed payload with this grant's provenance stamped on — the source's own flags survive. */
	stamped(source) {
		const flags   = this.itemData.flags ?? {};
		const stonetop = flags.stonetop ?? {};
		return {
			...this.itemData,
			flags: { ...flags, stonetop: { ...stonetop, grant: { source, key: this.key } } },
		};
	}
}

/**
 * Everything one source wants to exist, recomputed whole rather than tracked incrementally.
 *
 * An empty set means "nothing to say", NOT "delete everything": a compendium that is still loading (or
 * a module switched off) resolves nothing, and reading that as a source revoking its grants would
 * delete the character's moves. Taking a whole source back is `revoke`, which is something a caller
 * asks for on purpose.
 */
export class ItemGrantSet {
	constructor(source, grants = []) {
		this.source = source;
		this.grants = grants;
	}

	static empty(source) { return new ItemGrantSet(source, []); }

	/**
	 * One set per source, in first-seen order. A source speaks with one voice: a playbook's moves,
	 * followers, inserts and possessions are four builders but ONE answer to "what does this playbook
	 * want?" — applied separately, each would look like the source wanting nothing else, and the last
	 * one would delete what the others just granted.
	 */
	static mergeBySource(sets) {
		const bySource = new Map();
		for (const set of sets) {
			if (!bySource.has(set.source)) bySource.set(set.source, []);
			bySource.get(set.source).push(...set.grants);
		}
		return [...bySource].map(([source, grants]) => new ItemGrantSet(source, grants));
	}

	get isEmpty() { return this.grants.length === 0; }
	get keys()    { return this.grants.map(g => g.key); }
}

/**
 * Who granted an item. One vocabulary for every source, so `revoke` can name exactly what a grant named
 * — the asymmetry that used to let a deleted playbook leave its moves and followers behind.
 */
export class GrantSource {
	static playbook(slug)     { return `playbook:${slug}`; }
	static insert(slug)       { return `insert:${slug}`; }
	static arcanum(slug)      { return `arcana:${slug}`; }
	static reference(category) { return `reference:${category}`; }

	// The gear a container grants is a source of its own, distinct from the container's other grants:
	// an arcanum's card items and the followers the same card grants both belong to "arcana:the-ring",
	// and clearing one must not take the other with it.
	static outfit(containerSource) { return `outfit:${containerSource}`; }

	/**
	 * The source a move's category key names. Inserts and arcana name themselves in it; everything else
	 * (basic, expedition, special, follower, homefront, seasons) is a reference list seeded from the
	 * packs. Null for "other", where a hand-dropped move lands — nobody granted that.
	 */
	static forCategoryKey(categoryKey) {
		if (!categoryKey || categoryKey === "other") return null;
		for (const [prefix, source] of [
			["playbook-", GrantSource.playbook],
			["insert-",   GrantSource.insert],
			["arcana-",   GrantSource.arcanum],
		]) {
			if (categoryKey.startsWith(prefix)) return source(categoryKey.slice(prefix.length));
		}
		return GrantSource.reference(categoryKey);
	}

	/** Whether a source is a playbook — what makes a possession one of the playbook's picks rather
	 *  than something the player dropped in. */
	static isPlaybook(source) { return typeof source === "string" && source.startsWith("playbook:"); }
}

/** The provenance stamp an item carries, or null when nobody granted it. */
export class GrantStamp {
	constructor(source, key) {
		this.source = source;
		this.key    = key;
	}

	static of(item) {
		const grant = item?.flags?.stonetop?.grant;
		if (!grant?.source || !grant?.key) return null;
		return new GrantStamp(grant.source, grant.key);
	}

	static matches(item, source) {
		return GrantStamp.of(item)?.source === source;
	}
}
