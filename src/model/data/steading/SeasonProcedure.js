import { Moments } from "./Moments.js";
import { MoveResults } from "../MoveResults.js";
import { EFFECT_STEPS } from "./ImprovementEffect.js";
import { SteadingDefaults } from "./SteadingDefaults.js";
import { rich } from "../../snapshot/RichText.js";

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
 * So the procedure is data on the move ITEM, like every other piece of game content here. A step
 * carries both its STRUCTURE — a kind, a die, a count, which list to pick from — and the move's own
 * WORDS for it, in `text`.
 *
 * The words were left out at first, on the reasoning that the move's description rendered beside
 * these would say them once. It read badly: "Roll it" and "Roll 1d4" drop the trigger ("when winter
 * grips the land"), the roller ("whoever is the weariest") and winter's Meet with Disaster clause,
 * and the description ran into the numbered list rather than answering it. The move's description
 * moves to a collapsed disclosure instead, so only one copy is ever on screen. Pack prose is
 * translated through Babele like all other game content, so the clause on the step is the same
 * translation path as the clause in the description.
 *
 * `labelKey` stays as the fallback, for a homebrew Seasons Change whose steps carry no text.
 */

/**
 * One tier of the move's own roll — its 10+, its 7-9, its 6- — and what that tier makes the steading
 * DO.
 *
 * The words are never authored here. They are the move's own `moveResults`, the same ones its chat
 * card prints, so the two cannot drift and there is one thing to translate. A step adds only what the
 * sheet can act on: winter's 7-9 consumes another 1d4+Population, and the step says which tier, which
 * dice, and which way they move Surplus.
 *
 * The three tiers were one sentence on the step until a tier had something to do — "on a 10+ …; on a
 * 7-9, the steading must consume additional Surplus equal to 1d4+Population; on a 6-, as a 7-9" —
 * which put winter's second consumption in prose, with no control, no record and no way to undo it,
 * beside a first consumption that had all three.
 */
export class SeasonResult {
	constructor({ tier, die = null, stat = null, affects = null }) {
		this.tier    = tier;
		this.die     = die;
		this.stat    = stat;
		this.affects = affects;
	}

	get key()          { return this.tier.key; }
	get label()        { return this.tier.label; }
	get text()         { return this.tier.text; }
	/** Whether this tier costs the steading a roll of its own — what puts a control on the row. */
	get rollsDice()    { return Boolean(this.die); }
	get statLabelKey() { return this.stat ? `stonetop.steading.attr.${this.stat}` : null; }

	/**
	 * The move's authored tiers, each carrying whatever mechanics the step hangs on it by tier key.
	 *
	 * Mechanics for a tier the move does not have are dropped with the tier: a row the reader never
	 * sees cannot offer a roll. Mechanics that name nothing the sheet can move — no dice, or a side
	 * of the season that is neither consumption nor generation — leave the row as words, rather than
	 * a button that rolls and then changes nothing.
	 */
	static listFrom(moveResults, raw = null) {
		return (moveResults?.tiers ?? []).map(tier => new SeasonResult({
			tier, ...SeasonResult._mechanicsFor(raw?.[tier.key]),
		}));
	}

	static _mechanicsFor(raw) {
		const die     = typeof raw?.die === "string" && raw.die ? raw.die : null;
		const affects = EFFECT_STEPS.includes(raw?.affects) ? raw.affects : null;
		if (!die || !affects) return {};
		return { die, affects, stat: typeof raw?.stat === "string" && raw.stat ? raw.stat : null };
	}
}

/**
 * A roll the season calls for.
 *
 * `dieBySize` is the book's own table for a step whose dice depend on how big the steading is:
 * winter consumes 1d2+Population in a hamlet, 1d4+Population in a village and 2d6+Population in a
 * town. It was modelled as a Township effect ("roll 2d6+Population instead of 1d4+Population"),
 * which is what the improvement's own page says — but the dice follow the SIZE, not the improvement,
 * and a steading that shrank to a hamlet had nothing saying so.
 */
export class RollStep {
	constructor({ die = null, dieBySize = null, stat = null, tiers = false, text = null, affects = null,
	              results = null } = {}, moveResults = null) {
		this.die       = die;
		this.dieBySize = dieBySize && typeof dieBySize === "object" ? dieBySize : null;
		this.stat      = stat;
		this.text      = text ? rich(text) : null;
		this.affects   = affects;
		// Whether this is the move's OWN roll — the one its 10+/7-9/6- tiers belong to. It posts the
		// move's card and moves nothing, so it is the move's control rather than a step's.
		this.tiers = Boolean(tiers);
		// The move's own results, as rows this roll lands on. Only the tiered roll has them: every
		// other step is something the season does whatever was rolled.
		this.results = this.tiers ? SeasonResult.listFrom(moveResults, results) : [];
	}

	get kind()         { return "roll"; }
	get isTieredRoll() { return this.tiers; }
	/** A roll of its own dice, with no result tiers — winter's 1d4+Population. */
	get rollsDice()    { return !this.tiers; }
	get hasResults()   { return this.results.length > 0; }
	get labelKey()     { return this.tiers ? `${KEYS}.roll` : `${KEYS}.rollFormula`; }
	get statLabelKey() { return this.stat ? `stonetop.steading.attr.${this.stat}` : null; }

	/**
	 * The dice this step rolls for a steading of this size — its own where the step names no table,
	 * or where the size is not in it.
	 *
	 * An unlisted size takes the nearest SMALLER tier's dice, so a city consumes a town's 2d6 rather
	 * than dropping back to the village default. The book stops at town because Stonetop does; a
	 * steading that grew past it should not quietly consume less than it did as a town.
	 */
	dieFor(size) {
		if (!this.dieBySize) return this.die;
		if (this.dieBySize[size]) return this.dieBySize[size];
		const order = SteadingDefaults.rating("size")?.values ?? [];
		for (let i = order.indexOf(size) - 1; i >= 0; i--) {
			if (this.dieBySize[order[i]]) return this.dieBySize[order[i]];
		}
		return this.die;
	}
}

/** Surplus spent, in the amount the roll above it came to. */
export class ConsumeStep {
	constructor({ text = null, affects = null } = {}) {
		this.text    = text ? rich(text) : null;
		this.affects = affects;
	}

	get kind()     { return "consume"; }
	get labelKey() { return `${KEYS}.consume`; }
}

/** Surplus the season produces. */
export class GenerateStep {
	constructor({ die = null, text = null, affects = null } = {}) {
		this.die     = die;
		this.text    = text ? rich(text) : null;
		this.affects = affects;
	}

	get kind()      { return "generate"; }
	/** Summer's "the steading generates 1d4-1 Surplus" — dice the step names and the sheet can roll. */
	get rollsDice() { return Boolean(this.die); }
	/**
	 * The move's own wording where it names dice, and the sheet's where the step is one it added for
	 * the steading's gains — a season that generates nothing of its own has no sentence of the book's
	 * to print here, and "The steading generates {die} Surplus" with no die is not one.
	 */
	get labelKey()  { return this.die ? `${KEYS}.generate` : `${KEYS}.generateGains`; }
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
	constructor({ from = null, count = 1, text = null } = {}) {
		this.from  = from;
		this.count = count;
		this.text  = text ? rich(text) : null;
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
	constructor({ moment = null, die = null, text = null, affects = null } = {}) {
		this.moment  = moment;
		this.die     = die;
		this.text    = text ? rich(text) : null;
		this.affects = affects;
	}

	get kind()      { return "moment"; }
	/** Autumn's "when the harvest is complete, roll 1d4" — the season's own dice at the moment. */
	get rollsDice() { return Boolean(this.die); }
	get labelKey()  { return Moments.byKey(this.moment)?.labelKey ?? `${KEYS}.moment`; }
	/** What the season's own half of the moment does, beside the improvements that fire at it. */
	get noteKey()  { return this.die ? `${KEYS}.momentGenerate` : null; }
}

/** "Whatever the result, reset Fortunes to +1" — the one line every season's move ends on. */
export class ResetStep {
	constructor({ target = "fortunes", text = null } = {}) {
		this.target = target;
		this.text   = text ? rich(text) : null;
	}

	get kind()     { return "reset"; }
	get isReset()  { return true; }
	get labelKey() { return `${KEYS}.reset`; }
}

const KINDS = {
	roll:     (raw, moveResults) => new RollStep(raw, moveResults),
	consume:  raw => new ConsumeStep(raw),
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
	static from(raw, moveResults = null) {
		return KINDS[raw?.kind]?.(raw, moveResults) ?? null;
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
		// The move's own result tiers, handed to the step that rolls for them — the box draws the
		// results the card prints rather than a second copy authored on the step.
		const results = MoveResults.fromRaw(move.moveResults);
		const steps = raw.map(step => SeasonStep.from(step, results)).filter(Boolean);
		return new SeasonProcedure(steps.length ? steps : [new RollStep({ tiers: true }, results)]);
	}

	get isEmpty() { return this.steps.length === 0; }

	/** The choice this season hands the table, if it hands one — at most one per season. */
	get pick() { return this.steps.find(s => s.kind === "pick") ?? null; }

	/** The step that pays the steading out, where the move has one — summer's 1d4-1 Surplus. */
	get generation() { return this.steps.find(s => s.kind === "generate") ?? null; }

	/**
	 * The same procedure with somewhere for the steading's own gains to be paid.
	 *
	 * Spring and winter generate nothing of their own, but a steading can still generate in them —
	 * Township's Population+1, the market's Surplus, trade with Barrier Pass. Those used to sit in a
	 * list beside the season with an Apply per line, which is the one payout on the tab that was not
	 * a step of it.
	 *
	 * Inserted BEFORE the closing reset, because that is where summer's own move puts it: the season
	 * generates, and then Fortunes are reset whatever happened. Unchanged where the move already has
	 * a generation step of its own, which is the one the gains then ride.
	 */
	withGenerationStep() {
		if (this.generation) return this;
		const step = new GenerateStep({ affects: "generation" });
		const at   = this.steps.findIndex(s => s.isReset);
		const steps = [...this.steps];
		steps.splice(at < 0 ? steps.length : at, 0, step);
		return new SeasonProcedure(steps);
	}

	/**
	 * The step an improvement that bends this side of the season attaches to.
	 *
	 * The step that ROLLS for it wherever there is one — winter's 1d4+Population, summer's 1d4-1,
	 * autumn's 1d4 at the harvest — because that is the step carrying the control, and the control
	 * is what moves Surplus. Winter names `consumption` twice, on the roll and on the consume line
	 * that follows it; what bends the consumption bends the roll.
	 *
	 * Where nothing rolls for it, the last step that names it, so a homebrew season that only states
	 * its consumption still shows what bends it rather than dropping it.
	 */
	indexFor(affects) {
		if (!affects) return null;
		const mine = this.steps
			.map((step, index) => ({ step, index }))
			.filter(entry => entry.step.affects === affects);
		if (!mine.length) return null;
		return (mine.find(entry => entry.step.rollsDice) ?? mine.at(-1)).index;
	}
}
