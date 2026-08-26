import { GrantList } from "../../model/data/Grant.js";

/**
 * Hands the character the arcanum a choice row grants. Unlike a follower — which the granting card
 * already owns, so its mark only moves it on and off the roster tab — an arcanum granted this way is
 * owned BECAUSE of the mark: the Seeker's backgrounds each offer three major arcana and the marked one
 * is the one they walked in with. Marking embeds the card (and everything it grants in turn); clearing
 * the mark takes it back, along with whatever was recorded on it.
 *
 * Subscribes to choice-value changes and decides relevance itself: it needs the row that changed, so
 * it ignores writes with no row.
 */
export class ArcanumSideEffectHandler {
	constructor(arcana) {
		this._arcana = arcana;
	}

	async handle(change) {
		if (!change.affectsCounts || !change.target) return;
		for (const grant of GrantList.fromRaw(change.target.grants).ofType("arcanum")) {
			if (change.count > 0) await this._arcana.addArcanum(grant.slug);
			else await this._arcana.removeArcanum(grant.slug);
		}
	}
}
