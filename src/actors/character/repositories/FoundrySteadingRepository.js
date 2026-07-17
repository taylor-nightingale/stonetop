/**
 * Read-only view of the world's steading actor for display on character sheets.
 */
export class FoundrySteadingRepository {
	/**
	 * A world should have one steading, but strays happen (test actors left at the
	 * default name). Prefer the one named "Stonetop", then any renamed one, then first.
	 * @returns {import("../../steading/StonetopSteading.js").StonetopSteading|null} the typed actor
	 */
	_findSteading() {
		const steadings = globalThis.game?.actors?.filter?.(a => a.type === "steading") ?? [];
		const doc = steadings.length <= 1
			? steadings[0] ?? null
			: steadings.find(a => a.name?.trim().toLowerCase() === "stonetop")
				?? steadings.find(a => a.name !== _loc("stonetop.actor.defaultName.steading"))
				?? steadings[0];
		return doc?.typedActor ?? null;
	}

	/**
	 * @returns {{steadingName: string, value: number, lacking: boolean}|null}
	 *   value is the Prosperity roll bonus; lacking mirrors the steading's
	 *   "lacking" debility (treat Prosperity as 1 lower). Null when the world
	 *   has no steading actor.
	 */
	getProsperity() {
		return this._findSteading()?.getProsperity() ?? null;
	}
}

function _loc(key) {
	return globalThis.game?.i18n?.localize?.(key) ?? key;
}
