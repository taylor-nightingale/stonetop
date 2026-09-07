import { Moments } from "./Moments.js";

const KEYS = "stonetop.steading.seasons.steps";

/**
 * The steps of one Seasons Change move, as the move itself carries them.
 *
 * The sheet used to hardcode ONE procedure — roll it, pick 1 seasonal gain, reset Fortunes, apply
 * what Stonetop has built — which is Spring's, and wrong for the other three. Summer picks 2 on a
 * 10+ and generates 1d4-1 Surplus. Autumn rolls 1d4 at the harvest. Winter is two rolls with a
 * choice between them, and what it offers is a LOSS, not a gain: the old panel handed a winter
 * steading the gains list, which is the opposite of what winter does.
 *
 * So the procedure is data on the move ITEM, like every other piece of game content here. What the
 * step carries is STRUCTURE — a kind, a die, a count, which list to pick from. Never the book's
 * words: the move's own text is rendered open beside these, and a second copy of "whoever is
 * weariest" in the pack would be the same sentence to author, translate and keep in step twice.
 */

/** A roll the season calls for. */
export class RollStep {
	constructor({ die = null, stat = null, tiers = false } = {}) {
		this.die  = die;
		this.stat = stat;
		// Whether this is the move's OWN roll — the one its 10+/7-9/6- tiers belong to. Rolling that
		// is what turns the wheel, so it is the move's control rather than a step's.
		this.tiers = Boolean(tiers);
	}

	get kind()         { return "roll"; }
	get isTieredRoll() { return this.tiers; }
	/** A roll of its own dice, with no result tiers — winter's 1d4+Population. */
	get isFormulaRoll() { return !this.tiers; }
	get labelKey()     { return this.tiers ? `${KEYS}.roll` : `${KEYS}.rollFormula`; }
	get statLabelKey() { return this.stat ? `stonetop.steading.attr.${this.stat}` : null; }
}

/** Surplus spent, in the amount the roll above it came to. */
export class ConsumeStep {
	get kind()     { return "consume"; }
	get labelKey() { return `${KEYS}.consume`; }
}

/** Surplus the season produces. */
export class GenerateStep {
	constructor({ die = null } = {}) {
		this.die = die;
	}

	get kind()     { return "generate"; }
	get labelKey() { return `${KEYS}.generate`; }
}

/**
 * A choice the season hands the table — the seasonal gains, or what winter takes.
 *
 * `count` is the MOST it offers, not a rule: summer's move gives 2 on a 10+ and 1 on a 7-9, and the
 * sheet does not know which was rolled. Guiding rather than enforcing is the system's standing
 * position — the move's own text states the condition, and nothing here blocks a table from reading
 * it differently.
 */
export class PickStep {
	constructor({ from = null, count = 1 } = {}) {
		this.from  = from;
		this.count = count;
	}

	get kind()     { return "pick"; }
	get isPick()   { return true; }
	get labelKey() { return `${KEYS}.pick.${this.from}`; }
}

/**
 * A named point WITHIN the season, which the season's own move calls for.
 *
 * Autumn's move ends "when the harvest is complete, roll 1d4; the steading generates that much
 * Surplus" — the harvest is a step of Seasons Change: Autumn, and improvements hook the same moment.
 * The step names it; the moment itself is offered on the season's working surface, where the table
 * applies it whenever they say it happened.
 */
export class MomentStep {
	constructor({ moment = null, die = null } = {}) {
		this.moment = moment;
		this.die    = die;
	}

	get kind()     { return "moment"; }
	get labelKey() { return Moments.byKey(this.moment)?.labelKey ?? `${KEYS}.moment`; }
	/** What the season's own half of the moment does, beside the improvements that fire at it. */
	get noteKey()  { return this.die ? `${KEYS}.momentGenerate` : null; }
}

/** "Whatever the result, reset Fortunes to +1" — the one line every season's move ends on. */
export class ResetStep {
	constructor({ target = "fortunes" } = {}) {
		this.target = target;
	}

	get kind()     { return "reset"; }
	get isReset()  { return true; }
	get labelKey() { return `${KEYS}.reset`; }
}

const KINDS = {
	roll:     raw => new RollStep(raw),
	consume:  ()  => new ConsumeStep(),
	generate: raw => new GenerateStep(raw),
	pick:     raw => new PickStep(raw),
	moment:   raw => new MomentStep(raw),
	reset:    raw => new ResetStep(raw),
};

/**
 * The one place a step's `kind` is turned into a class — a factory, not a base class every step
 * inherits from. Each step is a plain concrete class answering the same few questions; nothing is
 * shared by inheritance, so no step can be half-defined by a parent.
 *
 * An unknown kind is dropped rather than rendered blank: a step the sheet cannot draw is a step the
 * table would tick and nothing would happen.
 */
export class SeasonStep {
	static from(raw) {
		return KINDS[raw?.kind]?.(raw) ?? null;
	}
}

export class SeasonProcedure {
	constructor(steps = []) {
		this.steps = steps;
	}

	/**
	 * The steps a move carries, in order.
	 *
	 * A move that carries none is still a move you ROLL — a homebrew Seasons Change, or one from a
	 * pack built before procedures existed — so it gets the one step every seasonal move has rather
	 * than nothing at all. Nothing else is assumed on its behalf: no gain to pick, no Fortunes to
	 * reset, because those are things a particular season's move says and this one does not.
	 *
	 * Null only where there is no move: a steading whose season move the GM deleted has no procedure,
	 * which is different from a procedure with nothing in it.
	 */
	static from(move) {
		if (!move) return null;
		const raw = Array.isArray(move.steps) ? move.steps : [];
		const steps = raw.map(SeasonStep.from).filter(Boolean);
		return new SeasonProcedure(steps.length ? steps : [new RollStep({ tiers: true })]);
	}

	get isEmpty() { return this.steps.length === 0; }

	/** The choice this season hands the table, if it hands one — at most one per season. */
	get pick() { return this.steps.find(s => s.kind === "pick") ?? null; }
}
