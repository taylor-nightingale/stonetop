import {SteadingDefaults} from "../../../model/data/steading/SteadingDefaults.js";

/**
 * Read-only view of the world's steading actor for display on character sheets.
 */
export class FoundrySteadingRepository {
	/**
	 * A world should have one steading, but strays happen (test actors left at the
	 * default name). Prefer the one named "Stonetop", then any renamed one, then first.
	 */
	_findSteading() {
		const steadings = globalThis.game?.actors?.filter?.(a => a.type === "steading") ?? [];
		if (steadings.length <= 1) return steadings[0] ?? null;
		const defaultName = _loc("stonetop.actor.defaultName.steading");
		return steadings.find(a => a.name?.trim().toLowerCase() === "stonetop")
			?? steadings.find(a => a.name !== defaultName)
			?? steadings[0];
	}

	/**
	 * @returns {{steadingName: string, value: number, lacking: boolean}|null}
	 *   value is the Prosperity roll bonus; lacking mirrors the steading's
	 *   "lacking" debility (treat Prosperity as 1 lower). Null when the world
	 *   has no steading actor.
	 */
	getProsperity() {
		const steading = this._findSteading();
		if (!steading) return null;
		const bonuses = SteadingDefaults.attributes.prosperity.bonuses;
		const current = steading.system?.attributes?.prosperity?.current;
		return {
			steadingName: steading.name,
			value:        bonuses[current] ?? 0,
			lacking:      steading.system?.debilities?.lacking === true,
		};
	}
}

function _loc(key) {
	return globalThis.game?.i18n?.localize?.(key) ?? key;
}
