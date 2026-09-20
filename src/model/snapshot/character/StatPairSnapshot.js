/**
 * A debility and the two stats it hinders, as one row.
 *
 * The book pairs them and the rules already do: a debility takes disadvantage on rolls with EITHER
 * of its two stats (CharacterDebilities#applyDebilityRollMode), and the three pairs between them
 * cover all six stats exactly once. So the pairing is not a layout convenience — it is the model,
 * and the rail draws it as a row of two stat tiles with the debility's own line beneath.
 *
 * Plain fields, no getters: a partial invoked with hash params gets a flattened copy of its context
 * and every prototype getter is lost in it, silently (see move-row.hbs).
 *
 * @property {DebilitySnapshot} debility
 * @property {StatSnapshot[]} stats - in the order the debility names them, so the row reads str→dex
 */
export class StatPairSnapshot {
	constructor(debility, stats) {
		this.debility = debility;
		this.stats    = stats;
	}

	/**
	 * The pairs, taken from the debilities themselves — the only place the grouping is written down.
	 * Deriving it here rather than restating it means a stat that changed hands would move in both
	 * the roll maths and the sheet, or in neither.
	 *
	 * @param {DebilitySnapshot[]} debilities
	 * @param {Record<string, StatSnapshot>} statsByKey - CharacterStats#buildStatsSnapshot's map
	 */
	static pairsFrom(debilities, statsByKey) {
		return debilities.map(debility =>
			new StatPairSnapshot(debility, debility.stats.map(key => statsByKey[key]).filter(Boolean))
		);
	}
}
