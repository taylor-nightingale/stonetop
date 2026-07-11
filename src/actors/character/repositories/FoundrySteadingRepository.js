import {SteadingDefaults} from "../../../model/data/steading/SteadingDefaults.js";

/**
 * Read-only view of the world's steading actor (the first one found — a
 * Stonetop world has exactly one) for display on character sheets.
 */
export class FoundrySteadingRepository {
	/**
	 * @returns {{steadingName: string, value: number, lacking: boolean}|null}
	 *   value is the Prosperity roll bonus; lacking mirrors the steading's
	 *   "lacking" debility (treat Prosperity as 1 lower). Null when the world
	 *   has no steading actor.
	 */
	getProsperity() {
		const steading = globalThis.game?.actors?.find?.(a => a.type === "steading");
		if (!steading) return null;
		const bonuses = SteadingDefaults.attributes.prosperity.bonuses;
		const current = steading.system?.attributes?.prosperity?.current;
		return {
			steadingName: steading.name,
			value:        bonuses[current] ?? 0,
			lacking:      !!steading.system?.debilities?.lacking,
		};
	}
}
