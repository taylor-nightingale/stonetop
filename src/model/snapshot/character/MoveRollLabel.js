import { STAT_KEYS } from "../../data/character/Stats.js";
import { SteadingDefaults } from "../../data/steading/SteadingDefaults.js";

const OWN_WORDS = {
	ask:   "stonetop.character.moves.rollLabel.ask",
	favor: "stonetop.character.moves.rollLabel.favor",
	omens: "stonetop.character.moves.rollLabel.omens",
};

/**
 * What a move adds to 2d6, as a row's stat column prints it — "+INT", "+FORT". Null where nothing is
 * added: a move that does not roll, and a prompt move, which rolls plain 2d6. The die says whether a
 * move rolls; this says only what it adds.
 */
export class MoveRollLabel {
	static of(rollStat, localize) {
		if (!rollStat || rollStat === "prompt") return null;
		return `+${MoveRollLabel._word(rollStat, localize).toLocaleUpperCase()}`;
	}

	static _word(rollStat, localize) {
		if (STAT_KEYS.includes(rollStat)) return localize(`stonetop.character.stats.abbr.${rollStat}`);
		const rating = SteadingDefaults.rating(rollStat);
		if (rating?.shortTitleKey) return localize(rating.shortTitleKey);
		if (OWN_WORDS[rollStat]) return localize(OWN_WORDS[rollStat]);
		return rollStat;
	}
}
