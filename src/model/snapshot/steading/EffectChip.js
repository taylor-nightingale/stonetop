import { Seasons } from "../../data/steading/Seasons.js";
import { Moments } from "../../data/steading/Moments.js";
import { formulaLabel } from "../../data/steading/formulaLabel.js";
import { SteadingDefaults } from "../../data/steading/SteadingDefaults.js";
import { formatRatingValue } from "./SteadingSnapshot.js";

/** The list an entry is written onto, by the heading the sheet already draws over it. */
const LIST_LABELS = {
	resources:      "stonetop.steading.lists.resources",
	fortifications: "stonetop.steading.lists.fortifications",
	items:          "stonetop.steading.lists.assets",
};

/**
 * One structured result of an improvement, compressed to a chip.
 *
 * A card shut is a name and a meter, which says how far along the work is and nothing at all about
 * what the work is FOR. The prose that answers that is inside the card, and paraphrasing it onto the
 * outside read oddly — a sentence about a sentence.
 *
 * A chip is not a paraphrase. It carries only what the result already states as data: the timing, the
 * amount, and the thing changed. `+1 Fortunes`, `Autumn +1 Surplus`, `Resources: Mill` — the numbers
 * the sentence contains, which are exactly what a glance cannot get from the sentence itself.
 *
 * Results with no structured payload get NO chip. Roadbuilding letting you build roads, Additional
 * Housing's new homes on the map: there is nothing to compress, and compressing it anyway is how the
 * old summary went wrong.
 */
export class EffectChip {
	constructor({ timingKeys = [], amount = "", subjectKey = null, text = "", moveSlug = null, earned = false }) {
		// When it fires, as localize keys — a season name, a moment, "every season". Empty for a
		// result that fires on completion: what an improvement earns needs no "when".
		this.timingKeys = timingKeys;
		// "+1" · "−1" · "1d4". Empty for a list entry, which has no amount.
		this.amount     = amount;
		this.subjectKey = subjectKey;
		// The entry's own words, for a chip that writes onto a list. Never prose: it is the name of
		// the thing added, which is what the book puts on the list.
		this.text       = text;
		// The MOVE this result confers, by slug — never by name. The template resolves it through the
		// same lookup the statement's roll buttons use, because Babele rewrites names and anything
		// matched on one silently disappears in a translated world.
		this.moveSlug   = moveSlug;
		// Whether this result's requirement holds YET. An unearned chip is what the improvement will
		// do; an earned one is what it does.
		this.earned     = earned;
	}

	/**
	 * When a result fires, as localize keys.
	 *
	 * A `turn` naming every season says "every season" rather than listing four, which is both
	 * shorter and what the book says.
	 */
	static timingFor(trigger) {
		if (trigger.isCompletion) return [];
		if (trigger.kind === "moment") {
			const moment = Moments.byKey(trigger.moment);
			return moment ? [moment.labelKey] : [];
		}
		if (trigger.isEverySeason) return ["stonetop.steading.seasons.everySeason"];
		return trigger.seasons.map(key => Seasons.byKey(key).labelKey);
	}

	/**
	 * A rating delta on its own — `+1 Surplus`.
	 *
	 * Timing-less by default, because the statement uses this too: on the season's own panel the
	 * timing IS the panel, and repeating "autumn" on every line of an autumn statement is noise.
	 */
	static forChange(change, { timingKeys = [], earned = false } = {}) {
		return new EffectChip({
			timingKeys, earned,
			// A formula through formulaLabel: it is authored as a ROLL expression, and `@population`
			// printed raw reads as a typo rather than as a rating.
			amount:     change.formula ? formulaLabel(change.formula)
				: `${change.amount < 0 ? "−" : "+"}${Math.abs(change.amount)}`,
			subjectKey: `stonetop.steading.attr.${change.target}`,
		});
	}

	/**
	 * A rating SET rather than moved — `Size: town`, `Population: +0`.
	 *
	 * Subject then value, the shape a list-entry chip already uses, because that is what a set is: this
	 * rating becomes this. A bare "+0 Population" in the delta position would read as a delta, which is
	 * the one thing a set is not — and for Size it would be nonsense, Size having no arithmetic.
	 *
	 * The value in the words the ledger writes it in: signed for a ±N rating (a "+0" the book prints
	 * too), bare for Surplus, and the tier's own word for Size rather than the slug stored for it.
	 */
	static forSet(set, { timingKeys = [], earned = false } = {}) {
		const rating = SteadingDefaults.rating(set.target);
		if (!rating) return null;
		return new EffectChip({
			timingKeys, earned,
			subjectKey: `stonetop.steading.attr.${set.target}`,
			text: rating.isNumeric ? formatRatingValue(set.target, set.value) : rating.tierLabel(set.value),
		});
	}

	/** An entry written onto one of the steading's evidence lists — `Resources: Mill`. */
	static forListEntry(entry, { timingKeys = [], earned = false } = {}) {
		return LIST_LABELS[entry.list]
			? new EffectChip({ timingKeys, earned, subjectKey: LIST_LABELS[entry.list], text: entry.text })
			: null;
	}

	/**
	 * A MOVE the improvement confers — the aurochs hunt, news at the inn, a heroic reputation.
	 *
	 * `Heroic Reputation` grants a move and nothing else, so with no chip for one it read as the
	 * emptiest row on a board where it has the most interesting payload. A move is exactly the kind
	 * of thing a chip is for: a name, and a die saying it is rolled.
	 */
	static forGrantedMove(slug, { timingKeys = [], earned = false } = {}) {
		return slug ? new EffectChip({ timingKeys, earned, moveSlug: slug }) : null;
	}

	/** One chip per structured payload — a result carrying two states both. */
	static forEffect(effect, boxes) {
		const context = {
			timingKeys: EffectChip.timingFor(effect.trigger),
			earned:     effect.holds(boxes),
		};
		return [
			effect.change     ? EffectChip.forChange(effect.change, context)       : null,
			effect.set        ? EffectChip.forSet(effect.set, context)             : null,
			effect.listEntry  ? EffectChip.forListEntry(effect.listEntry, context) : null,
			effect.grantsMove ? EffectChip.forGrantedMove(effect.grantsMove, context) : null,
		].filter(Boolean);
	}

	/** Every chip an improvement's results come to, against what has been ticked so far. */
	static forImprovement(improvement, storedValues = {}) {
		const boxes = improvement.boxesFrom(storedValues);
		return improvement.effects.all().flatMap(effect => EffectChip.forEffect(effect, boxes));
	}
}
