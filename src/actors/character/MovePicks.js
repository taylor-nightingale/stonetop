import { ChoiceValues } from "../../model/snapshot/character/ChoiceGroup.js";
import { findMoveItemBySlug, resolveMoveBySlug } from "../embeddedMoves.js";

/**
 * The picks on a move's own choice group, by move slug — the one store behind Potential for
 * Greatness's boxes and Well Versed's topics. Depends on nothing but the actor, so whatever marks a
 * move from outside it (a background, a migration) can hold one without the rest of CharacterMoves.
 */
export class MovePicks {
	constructor(actor, factory, moveRepo) {
		this._actor    = actor;
		this._factory  = factory;
		this._moveRepo = moveRepo;
	}

	/** The controller for one owned move's picks, or null when the move is absent or has no choices. */
	controllerFor(moveSlug) {
		const item = findMoveItemBySlug(this._actor, moveSlug);
		return item?.system?.choices ? this._factory.forDocument(item._id, "pickValues") : null;
	}

	countOf(moveSlug, groupSlug, optionSlug) {
		const item = findMoveItemBySlug(this._actor, moveSlug);
		return new ChoiceValues(item?.system?.pickValues ?? {}).getCount(groupSlug, optionSlug);
	}

	/** The move's choice group: the character's own copy, else the catalog's. */
	async choicesOf(moveSlug) {
		const move = await resolveMoveBySlug(this._actor, moveSlug, this._moveRepo);
		return move?.system?.choices ?? null;
	}
}
