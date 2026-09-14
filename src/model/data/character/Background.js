import { ChoiceGroupDefs } from "../ChoiceGroupDefs.js";

/**
 * One background out of a playbook's `backgrounds` list.
 *
 * A background hands out moves two different ways, and keeping them apart is the whole reason this is
 * a class rather than two field reads:
 *  - `moveSlugs` — moves the PLAYBOOK already owns (every one of them is in its own `moves` list).
 *    The background only makes them acquired; no item is created.
 *  - `grantedMoveSlugs` — moves only this background hands out, collected structurally from its
 *    choice group. These become items of their own, filed under `categoryKey`.
 */
export class Background {
	/** @returns {Background|null} — null for a slug this playbook doesn't have. */
	static find(playbookData, slug) {
		if (!slug) return null;
		return Background.of((playbookData?.backgrounds ?? []).find(b => b.slug === slug) ?? null);
	}

	static allFrom(playbookData) {
		return (playbookData?.backgrounds ?? []).map(def => new Background(def));
	}

	/** Wrap a raw def, passing null through — callers hold one that may not resolve. */
	static of(def) {
		return def ? new Background(def) : null;
	}

	/** Prefixed so `GrantSource.forCategoryKey` reads the background back out of it, and the moves tab
	 *  knows the category renders somewhere else. Static too, because a switch has to name the
	 *  category of the background it is leaving, which by then is only a slug. */
	static categoryKeyFor(slug) {
		return `background-${slug}`;
	}

	constructor(def) {
		this._def = def ?? {};
	}

	get slug()        { return this._def.slug ?? null; }
	get label()       { return this._def.label ?? null; }
	get categoryKey() { return Background.categoryKeyFor(this.slug); }
	get moveSlugs()   { return this._def.moves ?? []; }

	get grantedMoveSlugs() {
		return ChoiceGroupDefs.grants(this._def, "move").map(g => g.slug);
	}
}
