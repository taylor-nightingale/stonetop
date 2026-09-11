import { FoundryMoveRepository } from "../character/repositories/FoundryMoveRepository.js";
import { buildMoveSnapshot } from "../embeddedMoves.js";

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
 * So they stay in the pack and are looked up, then drawn as the ordinary move rows they are: a
 * disclosure over the move's own words, its die, its chat bubble. What the sheet used to do instead
 * was print a fragment of the move as advisory prose AND hang a "Roll X" button under it — two half
 * renderings of one move, neither of which was the move.
 */
export class GrantedMoves {
	constructor(actor, repo = new FoundryMoveRepository()) {
		this._actor = actor;
		this._repo  = repo;
	}

	/**
	 * The named moves as MoveSnapshots, keyed by slug — one lookup per render for the whole sheet,
	 * since the same move can be granted in more than one place.
	 *
	 * @param slugs the move slugs the owned improvements confer.
	 */
	async bySlug(slugs = []) {
		const wanted = [...slugs].filter(Boolean);
		if (!wanted.length) return {};
		const entries = await this._repo.getMoveEntriesBySlugs(wanted);
		const found = {};
		for (const entry of entries) {
			// Never selectable and never checked: a conferred move is not something the steading takes,
			// so the acquisition tick has nothing to record. No ResourceController either — these are
			// not owned items, so there is nothing for a resource box to persist onto.
			// Built from an entry with NO id: `_id` on a pack entry is the pack's, and a row stamped
			// with it as its owned id would claim an item the steading does not have — the roll would
			// look for it, fail to find it, and fall through to a bare stat roll. The row names its
			// move by slug instead (see StonetopActor#_onRoll).
			const move = buildMoveSnapshot({ ...entry, _id: null }, GrantedMoves.CATEGORY, false, null);
			if (move.slug) found[move.slug] = move;
		}
		return found;
	}

	/**
	 * The category key their rows render under — not one of SteadingMoveCategories, which is the
	 * point: it names the disclosure regions these rows open so they cannot collide with a move of
	 * the same slug listed on the Moves tab.
	 */
	static CATEGORY = "granted";
}
