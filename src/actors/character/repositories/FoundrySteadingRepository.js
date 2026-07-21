/**
 * Finds the steading a character calls home. That one steading answers both what the sheet
 * displays (Prosperity) and what a character rolls when a move reaches past its own stats
 * (Requisition's +Fortunes), so this hands back the typed actor and lets callers ask it directly.
 */
export class FoundrySteadingRepository {
	/**
	 * A world should have one steading, but strays happen (test actors left at the
	 * default name). Prefer the one named "Stonetop", then any renamed one, then first.
	 * @returns {import("../../steading/StonetopSteading.js").StonetopSteading|null} the typed actor
	 */
	getPrimary() {
		const steadings = globalThis.game?.actors?.filter?.(a => a.type === "steading") ?? [];
		const doc = steadings.length <= 1
			? steadings[0] ?? null
			: steadings.find(a => a.name?.trim().toLowerCase() === "stonetop")
				?? steadings.find(a => a.name !== _loc("stonetop.actor.defaultName.steading"))
				?? steadings[0];
		return doc?.typedActor ?? null;
	}
}

function _loc(key) {
	return globalThis.game?.i18n?.localize?.(key) ?? key;
}
