/**
 * The follower wiring carried by a choice-group entry (or pick option): which follower items the
 * row grants, and how they present. Stored in pack data as one grouped object under `followers`:
 *
 *   "followers": { "slugs": ["the-ring"], "inlineDisplay": true, "hideFromFollowersTab": true }
 *
 * `inlineDisplay`         — render the full follower card inline in the choice row.
 * `hideFromFollowersTab`  — the follower lives on its owning card only; the character sheet's
 *                           followers tab excludes it even while owned.
 *
 * (The legacy shape — a bare `followers` slug array with a sibling `inlineDisplay` flag — is
 * normalized to this object by migrateChoiceRow; runtime consumers only ever see this shape.)
 */
/** `showOnTab` false = card-only: the follower lives on its owning card, never the roster tab. */
export class FollowerGrant {
	constructor(slug, showOnTab) {
		this.slug      = slug;
		this.showOnTab = showOnTab;
	}
}

export class FollowerLink {
	constructor({ slugs = [], inlineDisplay = false, hideFromFollowersTab = false } = {}) {
		this.slugs                = slugs;
		this.inlineDisplay        = inlineDisplay;
		this.hideFromFollowersTab = hideFromFollowersTab;
	}

	grants() {
		return this.slugs.map(slug => new FollowerGrant(slug, !this.hideFromFollowersTab));
	}

	/** Parse a row's stored `followers` value. Returns null when the row links no followers. */
	static fromRaw(raw) {
		if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
		const slugs = Array.isArray(raw.slugs) ? raw.slugs.filter(Boolean) : [];
		if (!slugs.length) return null;
		return new FollowerLink({
			slugs,
			inlineDisplay:        !!raw.inlineDisplay,
			hideFromFollowersTab: !!raw.hideFromFollowersTab,
		});
	}

	toRaw() {
		return {
			slugs:                [...this.slugs],
			inlineDisplay:        this.inlineDisplay,
			hideFromFollowersTab: this.hideFromFollowersTab,
		};
	}
}
