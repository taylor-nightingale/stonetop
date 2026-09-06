import { parseRequirement } from "./ImprovementRequirement.js";
import { Seasons } from "./Seasons.js";

/**
 * One RESULT of an improvement: what has to be true for it to hold, when it fires, and what it does.
 *
 * The turnover changes the steading, so a result has to be more than a sentence — the sheet has to
 * work out what a season costs before the table commits. But the book's clauses are not one shape,
 * and flattening them into "a list of deltas" would misrepresent nine of them. What separates them
 * is not the payload but whether the sheet can be *sure*:
 *
 *   AUTOMATIC   a plain rating delta, or an entry to add to a list. Unambiguous arithmetic the
 *               sheet can offer to do — "+1 Surplus", 'add "Mill" to the Resources list'.
 *
 *   ADVISORY    everything else, stated with its source and left to the table: a die to roll, a
 *               condition the sheet cannot evaluate ("if the market is active"), an ADJUSTMENT that
 *               bends a step which has not run ("consumes 1 less Surplus than normal"), or pure
 *               fiction ("a threat makes itself known").
 *
 * `text` is never derived from the numbers. It is the book's own sentence, and it says things no
 * amount can — "or it disbands", "or else it ceases operation".
 */

export const EFFECT_TARGETS = ["surplus", "fortunes", "population", "prosperity", "defenses"];
export const EFFECT_LISTS   = ["resources", "fortifications", "items"];
export const EFFECT_STEPS   = ["consumption", "generation"];

/** A delta to a rating: `+1 Surplus`, or `+1d4 Surplus` where the book rolls for it. */
export class RatingChange {
	constructor({ target, amount = null, formula = null }) {
		this.target  = target;
		this.amount  = amount;
		this.formula = formula;
	}

	/** A plain number the sheet can apply without asking anyone anything. */
	get isAutomatic() { return Number.isInteger(this.amount) && !this.formula; }

	static fromRaw(raw) {
		if (!raw || !EFFECT_TARGETS.includes(raw.target)) return null;
		const amount  = Number.isInteger(raw.amount) ? raw.amount : null;
		const formula = typeof raw.formula === "string" && raw.formula ? raw.formula : null;
		return amount === null && formula === null
			? null
			: new RatingChange({ target: raw.target, amount, formula });
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
 * A bend applied to a step of the turnover that has not resolved yet — Stone Wall's "consumes 1 less
 * Surplus than normal", Township's "roll 2d6+Population instead of 1d4+Population". Never applied:
 * it changes an arithmetic the sheet does not perform.
 */
export class StepAdjustment {
	constructor({ step, amount = null, replaceFormula = null, term = null }) {
		this.step           = step;
		this.amount         = amount;
		this.replaceFormula = replaceFormula;
		this.term           = term;
	}

	static fromRaw(raw) {
		if (!raw || !EFFECT_STEPS.includes(raw.step)) return null;
		return new StepAdjustment({
			step:           raw.step,
			amount:         Number.isInteger(raw.amount) ? raw.amount : null,
			replaceFormula: typeof raw.replaceFormula === "string" ? raw.replaceFormula : null,
			term:           EFFECT_TARGETS.includes(raw.term) ? raw.term : null,
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
	constructor({ kind = "completed", seasons = [], moment = null } = {}) {
		this.kind    = kind;
		this.seasons = seasons;
		this.moment  = moment;
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
		});
	}
}

export class ImprovementEffect {
	constructor({ requires, trigger, text = "", change = null, listEntry = null, adjustment = null, condition = null, grantsMove = null }) {
		this.requires   = requires;
		this.trigger    = trigger;
		this.text       = text;
		this.change     = change;
		this.listEntry  = listEntry;
		this.adjustment = adjustment;
		this.condition  = condition;
		// A MOVE the improvement confers, by slug — the Aurochs Hunt, the Inn's news, a Heroic
		// Reputation. The book writes these as a trigger and three result tiers, which is a move and
		// not an effect, so it is one: an ordinary item in the moves pack, rolled through the ordinary
		// pipeline. Never seeded onto the steading — it shows on its improvement, and again wherever
		// it fires.
		this.grantsMove = grantsMove;
	}

	/** Whether this result currently holds — its requirement, over the improvement's tick state. */
	holds(boxes) { return this.requires.isMet(boxes); }

	/** Arithmetic the sheet can offer to do, with nothing left for a human to judge. */
	get isAutomatic() {
		return Boolean(this.change?.isAutomatic || this.listEntry)
			&& !this.condition
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
			listEntry:  ListEntry.fromRaw(raw?.listEntry),
			adjustment: StepAdjustment.fromRaw(raw?.adjustment),
			condition:  typeof raw?.condition === "string" && raw.condition.trim() ? raw.condition.trim() : null,
			grantsMove: typeof raw?.grantsMove === "string" && raw.grantsMove ? raw.grantsMove : null,
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
