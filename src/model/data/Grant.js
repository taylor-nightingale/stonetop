/**
 * A single thing a choice-group entry (or pick option) grants — a follower, a move, … — and where it
 * shows. Stored in pack/character data as one object inside the row's `grants` array:
 *
 *   "grants": [ { "type": "follower", "slug": "the-ring", "locations": ["inline"] } ]
 *
 * `type`      — selects the registry the slug resolves against (`followers.bySlug`, `moves.bySlug`) and
 *               the inline renderer (follower-card, move-row).
 * `locations` — where the granted thing appears: `"inline"` on the granting row, `"tab"` on that type's
 *               roster tab. It replaces the old follower booleans: `inlineDisplay` → `"inline"` present,
 *               `hideFromFollowersTab:false` → `"tab"` present.
 *
 * The granted item stays a dumb definition — this reference owns placement, so the same move/follower can
 * be granted from anywhere with different locations.
 */
export class Grant {
	constructor({ type, slug, locations = [] } = {}) {
		this.type      = type;
		this.slug      = slug;
		this.locations = Array.isArray(locations) ? [...locations] : [];
	}

	has(location)  { return this.locations.includes(location); }
	get inline()   { return this.has("inline"); }
	get onTab()    { return this.has("tab"); }

	toRaw() { return { type: this.type, slug: this.slug, locations: [...this.locations] }; }
}

/**
 * The `grants` array carried by one row/option — the single parser + authority (mirrors the old
 * FollowerLink for its one type). Pure and dependency-free.
 */
export class GrantList {
	constructor(grants = []) { this.grants = grants; }

	/** Parse a row's stored `grants` value. Skips malformed entries; never throws. */
	static fromRaw(raw) {
		if (!Array.isArray(raw)) return new GrantList([]);
		return new GrantList(
			raw.filter(g => g && typeof g === "object" && g.type && g.slug)
				.map(g => new Grant({ type: g.type, slug: g.slug, locations: g.locations })),
		);
	}

	/** Build from a legacy follower link object `{slugs, inlineDisplay, hideFromFollowersTab}` — one
	 *  follower Grant per slug. Used by migration; returns [] when there are no slugs. */
	static followerGrantsFromLink(link) {
		const slugs = Array.isArray(link?.slugs) ? link.slugs.filter(Boolean) : [];
		const locations = [
			...(link?.inlineDisplay ? ["inline"] : []),
			...(link?.hideFromFollowersTab ? [] : ["tab"]),
		];
		return slugs.map(slug => new Grant({ type: "follower", slug, locations }));
	}

	get isEmpty()      { return this.grants.length === 0; }
	ofType(type)       { return this.grants.filter(g => g.type === type); }
	slugsOfType(type)  { return this.ofType(type).map(g => g.slug); }
	toRaw()            { return this.grants.map(g => g.toRaw()); }
}
