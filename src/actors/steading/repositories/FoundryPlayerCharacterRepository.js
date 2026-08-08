/**
 * The player characters at the table. "Let Spring Break Forth" asks each player what excites them
 * most about their character, so the section needs one row per PC. Hands back the actor documents;
 * the shape the sheet renders is codified by ExcitesRowSnapshot, not by this repository.
 */
export class FoundryPlayerCharacterRepository {
	/**
	 * @returns {Array<object>} every character actor in the world, in world order
	 */
	list() {
		return globalThis.game?.actors?.filter?.(a => a.type === "character") ?? [];
	}
}
