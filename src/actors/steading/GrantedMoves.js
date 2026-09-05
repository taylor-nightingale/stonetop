import { FoundryMoveRepository } from "../character/repositories/FoundryMoveRepository.js";
import { GrantedMoveSnapshot } from "../../model/snapshot/steading/GrantedMoveSnapshot.js";

/**
 * The moves the steading's improvements confer — resolved from the pack, never embedded.
 *
 * The Aurochs Hunt, the Inn's news, a Heroic Reputation: the book writes each as a trigger and three
 * result tiers, which is a move and not a rating change. But they are not the steading's moves in the
 * way Seasons Change is. They belong to the improvement that granted them, and they are read in the
 * two places they matter — on that improvement's card, and at the moment they fire. Seeding them onto
 * the actor would file them under Homefront on the Moves tab, a third place, severed from the thing
 * that earned them.
 *
 * So they stay in the pack and are looked up. A roll needs a name, a stat and result tiers, all of
 * which a pack index entry carries; nothing about rolling a move requires the actor to own it.
 */
export class GrantedMoves {
	constructor(actor, repo = new FoundryMoveRepository()) {
		this._actor = actor;
		this._repo  = repo;
	}

	/**
	 * The named moves, keyed by slug — one lookup per render for the whole sheet, since the same move
	 * can be granted in more than one place.
	 */
	async bySlug(slugs = []) {
		const wanted = [...new Set(slugs.filter(Boolean))];
		if (!wanted.length) return {};
		const entries = await this._repo.getMoveEntriesBySlugs(wanted);
		const found = {};
		for (const entry of entries) {
			const move = new GrantedMoveSnapshot(entry);
			if (move.slug) found[move.slug] = move;
		}
		return found;
	}

	/** Roll one, as the steading. The chat card is an ordinary move card — there is no second kind. */
	async roll(slug) {
		const [entry] = await this._repo.getMoveEntriesBySlugs([slug]);
		if (!entry) return false;
		await this._actor.rollItem(entry);
		return true;
	}
}
