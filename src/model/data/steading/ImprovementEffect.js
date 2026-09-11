import { parseRequirement } from "./ImprovementRequirement.js";
import { OutcomeRange } from "./OutcomeRange.js";
import { Seasons } from "./Seasons.js";
import { SteadingDefaults } from "./SteadingDefaults.js";

/**
 * One RESULT of an improvement: what has to be true for it to hold, when it fires, and what it does.
 *
 * The turnover changes the steading, so a result has to be more than a sentence — the sheet has to
 * work out what a season costs before the table commits. But the book's clauses are not one shape,
 * and flattening them into "a list of deltas" would misrepresent nine of them. What separates them
 * is not the payload but whether the sheet can be *sure*:
 *
 *   AUTOMATIC   a plain rating delta, a rating set outright, or an entry to add to a list.
 *               Unambiguous arithmetic the sheet can offer to do — "+1 Surplus", "Size to town",
 *               'add "Mill" to the Resources list'.
 *
 *   ADVISORY    everything else, stated with its source and left to the table: a die to roll, a
 *               clause the sheet cannot evaluate ("if the market is active"), an ADJUSTMENT that
 *               bends a step which has not run ("consumes 1 less Surplus than normal"), or pure
 *               fiction ("a threat makes itself known").
 *
 * `text` is never derived from the numbers. It is the book's own sentence, and it says things no
 * amount can — "or it disbands", "or else it ceases operation".
 */

// The ratings a DELTA can move. Not exported: EFFECT_SET_TARGETS is the wider list a result can name,
// and it is the one every caller outside this file wants.
const EFFECT_TARGETS = ["surplus", "fortunes", "population", "prosperity", "defenses"];
export const EFFECT_LISTS   = ["resources", "fortifications", "items"];
export const EFFECT_STEPS   = ["consumption", "generation"];

/**
 * The ratings a result can SET. Size is settable and never addable — see RatingSet — so it is here
 * and deliberately not in EFFECT_TARGETS, which is what a delta, an adjustment's term and the
 * statement's arithmetic are all bounded by.
 */
export const EFFECT_SET_TARGETS = [...EFFECT_TARGETS, "size"];

/**
 * WHERE in a step an adjustment hooks. Four genuinely different things were collapsed into one
 * list headed "when the steading consumes Surplus", and the sheet rendered all of them the same:
 *
 *   formula  the dice and the rating the step rolls are REPLACED — Township's 2d6+Population
 *   term     a rating in that formula counts differently — Additional Housing's "Population 1 lower"
 *   result   what you pay once it is rolled — Stone Wall's "1 less Surplus than normal"
 *
 * The first two feed the step's own roll control; the third is what you actually pay.
 */
export const ADJUSTMENT_HOOKS = ["formula", "term", "result"];

/** A delta to a rating: `+1 Surplus`, or `+1d4 Surplus` where the book rolls for it. */
export class RatingChange {
	constructor({ target, amount = null, formula = null }) {
		this.target  = target;
		this.amount  = amount;
		this.formula = formula;
	}

	/** A plain number the sheet can apply without asking anyone anything. */
	get isAutomatic() { return Number.isInteger(this.amount) && !this.formula; }

	/** Whether the book ROLLS for this. Dice are the table's; everything else is arithmetic. */
	get hasDice() { return Boolean(this.formula && /\d*d\d/i.test(this.formula)); }

	/**
	 * What this comes to for a steading whose ratings are these — Township's "@population + 1" as the
	 * number it is worth today.
	 *
	 * A formula is not automatically a die. `@population + 1` is arithmetic over a rating the sheet
	 * already knows, and refusing to work it out left Township's spring Surplus as the one payout on
	 * the tab with nothing to press.
	 *
	 * Null where the dice decide it, and null for anything that is not a plain sum of ratings and
	 * whole numbers — which is all the book writes here. A homebrew "2 * @population" is stated and
	 * left to the table rather than evaluated by an expression parser this file has no business
	 * growing.
	 */
	amountFrom(ratings = {}) {
		if (Number.isInteger(this.amount)) return this.amount;
		if (!this.formula || this.hasDice) return null;
		const expression = this.formula.replace(/\s+/g, "");
		if (!/^[+-]?(?:@\w+|\d+)(?:[+-](?:@\w+|\d+))*$/.test(expression)) return null;
		let total = 0;
		for (const [, sign, term] of expression.matchAll(/([+-]?)(@\w+|\d+)/g)) {
			const value = term.startsWith("@") ? ratings[term.slice(1)] : Number(term);
			if (!Number.isFinite(value)) return null;
			total += sign === "-" ? -value : value;
		}
		return total;
	}

	static fromRaw(raw) {
		if (!raw || !EFFECT_TARGETS.includes(raw.target)) return null;
		const amount  = Number.isInteger(raw.amount) ? raw.amount : null;
		const formula = typeof raw.formula === "string" && raw.formula ? raw.formula : null;
		return amount === null && formula === null
			? null
			: new RatingChange({ target: raw.target, amount, formula });
	}
}

/**
 * A rating SET to a value rather than moved by one — Township's "change Size to town and its
 * Population to +0".
 *
 * Not a `change` with an amount. A delta cannot say "to +0": what it would come to depends on where
 * Population stood, and the book means zero from wherever it was. It is also the only payload that
 * can touch Size, which is a named tier and not a quantity — "+1 Size" is not a sentence the book
 * ever writes.
 *
 * Reverting one needs the value it replaced, which a delta never has to record. That is AppliedEffect's
 * job, not this class's: this is the authored instruction, not what happened when it ran.
 */
export class RatingSet {
	constructor({ target, value }) {
		this.target = target;
		this.value  = value;
	}

	/** Whether this names a quantity, as against Size's tier word. */
	get isNumeric() { return Number.isInteger(this.value); }

	/** What the rating reads as when the steading has never set it — the value a revert falls back on. */
	get unsetValue() { return this.isNumeric ? 0 : ""; }

	/**
	 * Validated against the RATING's own values, so a tier word cannot be authored onto Population and
	 * a mistyped Size fails here rather than writing a tier the select cannot show.
	 */
	static fromRaw(raw) {
		if (!raw || !EFFECT_SET_TARGETS.includes(raw.target)) return null;
		const rating = SteadingDefaults.rating(raw.target);
		if (!rating) return null;
		const value = rating.isNumeric
			? (Number.isInteger(raw.value) ? raw.value : null)
			: (rating.values.includes(raw.value) ? raw.value : null);
		return value === null ? null : new RatingSet({ target: raw.target, value });
	}
}

/**
 * Moves the improvement says the steading rolls BETTER — Township's "when you Muster, Pull Together,
 * or Trade & Barter, you have advantage".
 *
 * Modelled so the sheet can REMIND the table, and for no other reason. It does not flip a die and must
 * not: the roll-mode control belongs to the table, four of the book's five advantage clauses wait on
 * fiction the sheet cannot see ("when you take advantage of the palisade"), and an RPG sheet that
 * decides for you is the thing this system deliberately does not build. The reminder is what stops
 * anybody having to remember which of six improvements said so.
 *
 * Moves by SLUG, never by name: Babele rewrites names, and anything matched on one silently stops
 * matching in a translated world.
 */
export class MoveAdvantage {
	constructor({ moves = [] }) {
		this.moves = moves;
	}

	static fromRaw(raw) {
		const moves = (Array.isArray(raw?.moves) ? raw.moves : [])
			.filter(slug => typeof slug === "string" && slug.trim())
			.map(slug => slug.trim());
		return moves.length ? new MoveAdvantage({ moves }) : null;
	}
}

/** Something to write onto one of the steading's evidence lists — `add "Mill" to the Resources list`. */
export class ListEntry {
	constructor({ list, text }) {
		this.list = list;
		this.text = text;
	}

	static fromRaw(raw) {
		return raw && EFFECT_LISTS.includes(raw.list) && typeof raw.text === "string" && raw.text.trim()
			? new ListEntry({ list: raw.list, text: raw.text.trim() })
			: null;
	}
}

/**
 * A bend applied to a step of the turnover — Stone Wall's "consumes 1 less Surplus than normal",
 * Township's "roll 2d6+Population instead of 1d4+Population".
 *
 * `step` says WHICH step, through the `affects` the seasons moves carry; `at` says where in it.
 * Township carries the pair `rollSeasonStep` already takes — a die and a rating — rather than a
 * formula string, so the rating still resolves through resolveBonus, debilities and all.
 */
export class StepAdjustment {
	constructor({ step, at = "result", amount = null, term = null, die = null, stat = null }) {
		this.step   = step;
		this.at     = at;
		this.amount = amount;
		this.term   = term;
		this.die    = die;
		this.stat   = stat;
	}

	get isFormula() { return this.at === "formula"; }
	get isTerm()    { return this.at === "term"; }
	get isResult()  { return this.at === "result"; }

	/**
	 * An unstated hook is read off the payload — a die can only be a replacement formula, a named
	 * term can only bend one, and everything else is the amount you end up paying. Authored data
	 * states it; a homebrew improvement written against the older shape still lands somewhere true.
	 */
	static fromRaw(raw) {
		if (!raw || !EFFECT_STEPS.includes(raw.step)) return null;
		const die  = typeof raw.die === "string" && raw.die ? raw.die : null;
		const term = EFFECT_TARGETS.includes(raw.term) ? raw.term : null;
		return new StepAdjustment({
			step:   raw.step,
			at:     ADJUSTMENT_HOOKS.includes(raw.at) ? raw.at : (die ? "formula" : term ? "term" : "result"),
			amount: Number.isInteger(raw.amount) ? raw.amount : null,
			term,
			die,
			stat:   EFFECT_TARGETS.includes(raw.stat) ? raw.stat : null,
		});
	}
}

/**
 * When a result fires.
 *
 *   completed  once, when its requirement first holds — the +1 Fortunes and the Resources entry
 *   turn       when the wheel turns, in the named seasons (empty = every season)
 *   moment     at a named moment within a season — the autumn harvest, the aurochs hunt
 *
 * There is deliberately no `lapsed`: "if you cease to meet the requirements, decrease Prosperity by
 * 1" is this result's REQUIREMENT going false again, not a fourth kind of trigger.
 */
export class EffectTrigger {
	constructor({ kind = "completed", seasons = [], moment = null, phrase = null } = {}) {
		this.kind    = kind;
		this.seasons = seasons;
		this.moment  = moment;
		// The book's own words for this trigger — "when summer comes and you roll a 7+ with Fortunes".
		// The season's box never needs them (the step, the tier or the panel has just said when), so
		// they exist for the one surface that is not inside a season: the improvement's own card, where
		// the clause and the result read as the sentence the book prints.
		this.phrase  = phrase;
	}

	get isCompletion() { return this.kind === "completed"; }

	/** Every season, when a `turn` names none — Standing Watch, the Inn. */
	get isEverySeason() {
		return this.kind === "turn"
			&& (this.seasons.length === 0 || Seasons.all().every(s => this.seasons.includes(s.key)));
	}

	firesAt(kind, season = null, moment = null) {
		if (this.kind !== kind) return false;
		if (kind === "turn")   return this.seasons.length === 0 || this.seasons.includes(season?.key);
		if (kind === "moment") return this.moment === moment;
		return true;
	}

	static fromRaw(raw) {
		const kind = ["completed", "turn", "moment"].includes(raw?.kind) ? raw.kind : "completed";
		return new EffectTrigger({
			kind,
			seasons: Array.isArray(raw?.seasons)
				? raw.seasons.filter(k => Seasons.all().some(s => s.key === k))
				: [],
			moment: typeof raw?.moment === "string" ? raw.moment : null,
			phrase: typeof raw?.phrase === "string" && raw.phrase.trim() ? raw.phrase.trim() : null,
		});
	}
}

export class ImprovementEffect {
	constructor({ requires, trigger, text = "", change = null, set = null, listEntry = null, adjustment = null, condition = false, outcome = null, grantsMove = null, advantage = null }) {
		this.requires   = requires;
		this.trigger    = trigger;
		this.text       = text;
		this.change     = change;
		// A rating SET rather than moved — Township's Size and Population. Arithmetic the sheet can do
		// with nothing left to judge, so it is applied like a delta and reverted by restoring what it
		// replaced.
		this.set        = set;
		this.listEntry  = listEntry;
		this.adjustment = adjustment;
		// Whether the sheet can TELL that this result's clause holds. The WORDS are the trigger's —
		// `when.phrase` carries "as long as the camp is in operation" in the book's voice, and every
		// surface that has not already said it reads the clause and the text as one sentence. This is
		// only the fact that the sheet cannot judge it, which is what keeps it out of `isAutomatic`.
		this.condition  = condition;
		// The results of the season's OWN roll this result waits on — Harnessing the Stream and
		// Raincatching both read "if you roll a 7+ with Fortunes". Not a condition the sheet cannot
		// evaluate but a fact about the move's own roll, so it belongs against the rows that roll it
		// rather than in a list of advice floating beside the season: an OutcomeRange, because "7+"
		// is the 10+ row and the 7-9 row both. The clause still carries the words; this says which
		// rows they answer.
		this.outcome    = outcome;
		// A MOVE the improvement confers, by slug — the Aurochs Hunt, the Inn's news, a Heroic
		// Reputation. The book writes these as a trigger and three result tiers, which is a move and
		// not an effect, so it is one: an ordinary item in the moves pack, rolled through the ordinary
		// pipeline. Never seeded onto the steading — it shows on its improvement, and again wherever
		// it fires.
		this.grantsMove = grantsMove;
		// Moves this improvement entitles the steading to roll with advantage. A REMINDER only — see
		// MoveAdvantage. It is why this result is never `isAutomatic`: there is nothing to write.
		this.advantage  = advantage;
	}

	/** Whether this result currently holds — its requirement, over the improvement's tick state. */
	holds(boxes) { return this.requires.isMet(boxes); }

	/**
	 * The same result with any arithmetic over the steading's OWN ratings worked out — Township's
	 * "Surplus equal to Population+1" as the number it is worth today.
	 *
	 * The season's statement resolves; an improvement's own card deliberately does not. The card
	 * states what the improvement DOES, in the book's terms, for a steading that may not exist yet;
	 * the season states what it does here, now, and has a control that has to write a number.
	 */
	resolvedFor(ratings = {}) {
		const amount = this.change?.amountFrom(ratings);
		if (!Number.isInteger(amount) || Number.isInteger(this.change.amount)) return this;
		return new ImprovementEffect({
			...this, change: new RatingChange({ target: this.change.target, amount }),
		});
	}

	/** Whether the clause is one the sheet cannot judge — stated, and never applied. */
	get isConditional() { return this.condition; }

	/** Whether this result waits on the season's own roll landing in a range of its results. */
	get isOutcomeGated() { return Boolean(this.outcome); }

	/** Whether it waits on THIS row of the move's own results — the 10+ and the 7-9 both, for a 7+. */
	firesOnTier(tierKey) { return Boolean(this.outcome?.includes(tierKey)); }

	/**
	 * Whether the only thing between this and plain arithmetic is which way the roll went.
	 *
	 * An outcome is NOT a condition the sheet cannot evaluate. "If you roll a 7+ with Fortunes" is a
	 * fact about a roll the sheet shows the table, printed inside the result rows it covers — and the
	 * reader answers it by pressing the button on the row the dice landed on. Nothing here decides
	 * anything; it is the same Apply every other result gets, on the one row where it applies.
	 *
	 * Such a result's clause states the outcome in words ("when summer comes and you roll a 7+ with
	 * Fortunes"), which is why the row it is printed in does not repeat it: the row has said it.
	 */
	get isOutcomeArithmetic() {
		return this.isOutcomeGated
			&& Boolean(this.change?.isAutomatic || this.set || this.listEntry)
			&& !this.adjustment && !this.grantsMove;
	}

	/**
	 * A bill the steading pays each season for something it built — the watch's Surplus "or it
	 * disbands", the militia's practice, the logging camp's keep.
	 *
	 * Not a step of the move: nothing in Seasons Change says any of it. So it is asked here rather
	 * than listed anywhere, and the four that answer true are exactly the four the book charges.
	 */
	get isUpkeep() {
		return this.trigger.kind === "turn"
			&& this.change?.target === "surplus"
			&& Number.isInteger(this.change.amount) && this.change.amount < 0;
	}

	/** Arithmetic the sheet can offer to do, with nothing left for a human to judge. */
	get isAutomatic() {
		return Boolean(this.change?.isAutomatic || this.set || this.listEntry)
			&& !this.isConditional
			&& !this.outcome
			&& !this.adjustment
			// A move is rolled, and what it does depends on the roll. Nothing to apply in advance.
			&& !this.grantsMove;
	}

	get isAdvisory() { return !this.isAutomatic; }

	/**
	 * @param raw              the authored result
	 * @param defaultRequires  the improvement's own requirement, used when the result states none.
	 *
	 * Most results inherit it — the Mill's autumn Surplus needs exactly what the Mill needs. Only a
	 * result that NARROWS states its own, as Well-Trained Militia's "+1 Defenses" does by also
	 * wanting two trained tactics. Defaulting to "nothing required" instead would fire every result
	 * of every improvement the moment it was owned, built or not.
	 */
	static fromRaw(raw, defaultRequires = undefined) {
		return new ImprovementEffect({
			requires:   parseRequirement(raw?.requires !== undefined ? raw.requires : defaultRequires),
			trigger:    EffectTrigger.fromRaw(raw?.when),
			text:       typeof raw?.text === "string" ? raw.text : "",
			change:     RatingChange.fromRaw(raw?.change),
			set:        RatingSet.fromRaw(raw?.set),
			listEntry:  ListEntry.fromRaw(raw?.listEntry),
			adjustment: StepAdjustment.fromRaw(raw?.adjustment),
			// Boolean() rather than a strict read: an improvement embedded on a steading before the
			// flag replaced the duplicated words still stores the sentence, and a non-empty one means
			// exactly what the flag now means.
			condition:  Boolean(raw?.condition),
			outcome:    OutcomeRange.fromRaw(raw?.outcome),
			grantsMove: typeof raw?.grantsMove === "string" && raw.grantsMove ? raw.grantsMove : null,
			advantage:  MoveAdvantage.fromRaw(raw?.advantage),
		});
	}
}

/** An improvement's results, as a thing that can be asked questions. */
export class ImprovementEffects {
	constructor(effects = []) {
		this._effects = effects;
	}

	static fromRaw(raw, defaultRequires = undefined) {
		return new ImprovementEffects((Array.isArray(raw) ? raw : [])
			.map(effect => ImprovementEffect.fromRaw(effect, defaultRequires))
			.filter(effect => effect.text));
	}

	get isEmpty() { return this._effects.length === 0; }

	all() { return [...this._effects]; }

	/**
	 * The results that fire at this trigger AND whose requirement currently holds.
	 *
	 * Both halves matter: a mill generates nothing each autumn until there is a mill, and the
	 * militia's Defenses bump waits on two trained tactics however many seasons pass.
	 */
	firingAt(kind, boxes, options = {}) {
		return this.entriesFiringAt(kind, boxes, options).map(entry => entry.effect);
	}

	/**
	 * Every result with its position, whatever it fires at and whether or not it holds yet.
	 *
	 * What an improvement's own card is built from: it has to state the whole payoff, including the
	 * halves that are not owed yet, because the prose that used to state it is no longer in the pack.
	 */
	entries() {
		return this._effects.map((effect, index) => ({ effect, index }));
	}

	/**
	 * The same, each with its position in the improvement's full result list.
	 *
	 * A caller that identifies a result across renders needs an index that does not move — the
	 * position among the results FIRING this season shifts the moment a different season is asked
	 * about, which would migrate a table's ticks onto the wrong clause.
	 */
	entriesFiringAt(kind, boxes, { season = null, moment = null } = {}) {
		return this._effects
			.map((effect, index) => ({ effect, index }))
			.filter(({ effect }) => effect.trigger.firesAt(kind, season, moment) && effect.holds(boxes));
	}

	/**
	 * Whether the improvement is BUILT — whether anything it promises is true yet.
	 *
	 * Deliberately ANY result rather than every one. Well-Trained Militia's "+1 Defenses" waits on two
	 * trained tactics, but the militia itself exists as soon as there is a veteran warrior to command
	 * it — and its summer upkeep says so by requiring only that. Demanding every result would leave
	 * the militia unbuilt for as long as the table trained one tactic.
	 *
	 * For the Mill nothing holds until all five requirements do, which is the same answer as before by
	 * a better route.
	 */
	isBuilt(boxes) {
		return this._effects.some(e => e.holds(boxes));
	}
}
