import { AdjustedStepRoll, SeasonAdjustments } from "./SeasonAdjustments.js";
import { SeasonStepAddress } from "../../data/steading/SeasonStepAddress.js";
import { StepContribution } from "./StepContribution.js";

/**
 * One step of the season's move as the box draws it: the step, and everything this steading brings
 * to that step.
 *
 * The step alone was not enough once improvements hooked it. The partial was reaching back up to the
 * root for two of these already — the applied record by `@index`, the pick group off the snapshot —
 * which is the shape of a missing object: the things a step is rendered with, gathered under the step
 * they belong to, so the template asks one thing one question.
 */
export class SeasonStepSnapshot {
	constructor({ step, index, roll = null, adjustments = [], results = [], applied = null, pick = null,
	              tiers = [], contribution = null, sizeRoll = null }) {
		this.step     = step;
		this.index    = index;
		// What addresses this step's own roll, in the store and on its control.
		this.address  = SeasonStepAddress.of(index);
		// The dice this step actually rolls, or null for a step that rolls none.
		this.roll     = roll;
		// Everything the steading has built that bends this step, each in the book's own words. What
		// is READ: the sheet says which hook each one is by rolling the right dice and paying the
		// right amount, not by narrating a summary of the clauses.
		this.adjustments = adjustments;
		// The subset that changes what this step PAYS once it is rolled — what the roll does with
		// them, as against what the reader is shown.
		this.results  = results;
		// What this step has already done to Surplus this season, or null while it is still to roll.
		this.applied  = applied;
		// The choice this step calls for, where it calls for one.
		this.pick     = pick;
		// The move's own results as rows this roll lands on — empty for every step but the tiered
		// roll. Each carries whatever that tier makes the steading do, so winter's 7-9 offers the
		// second 1d4+Population where it is written rather than nowhere.
		this.tiers    = tiers;
		// What the steading has built that belongs to this step — the mill at the harvest, the town's
		// Population+1 where the season generates. Folded into what the step pays rather than
		// panelled below it: one event was being paid twice in two places. A StepContribution, or null.
		this.contribution = contribution;
		// What this steading's Size makes of the step's dice, where it makes anything of them. Null
		// for a village, whose dice are the ones the move's own line already names.
		this.sizeRoll = sizeRoll;
	}

	get number()       { return this.index + 1; }
	get text()         { return this.step.text ?? null; }
	get labelKey()     { return this.step.labelKey; }
	get noteKey()      { return this.step.noteKey ?? null; }
	get count()        { return this.step.count ?? null; }
	get affects()      { return this.step.affects ?? null; }
	get isTieredRoll() { return Boolean(this.step.isTieredRoll); }
	get rollsDice()    { return Boolean(this.step.rollsDice); }
	get isReset()      { return Boolean(this.step.isReset); }
	get isPick()       { return Boolean(this.step.isPick); }

	/** The dice and rating the control offers — the adjusted ones where anything adjusted them. */
	get die()          { return this.roll?.die ?? null; }
	get stat()         { return this.roll?.stat ?? null; }
	get statLabelKey() { return this.roll?.statLabelKey ?? this.step.statLabelKey ?? null; }
	/** What the control prints after the rating — "− 2" — or null where the roll adds nothing. */
	get modifierLabel() { return this.roll?.modifierLabel ?? null; }

	get hasAdjustments() { return this.adjustments.length > 0; }
	get hasTiers()       { return this.tiers.length > 0; }
	get hasContribution() { return Boolean(this.contribution?.hasLines); }
	get hasSizeRoll()    { return Boolean(this.sizeRoll); }

	/** One of this step's result rows, by tier key — how an address resolves to what it addresses. */
	tierFor(key) { return this.tiers.find(tier => tier.key === key) ?? null; }

	/**
	 * What the results change about the amount, as a signed number.
	 *
	 * The signs already agree: Stone Wall's −1 is one less Surplus consumed, the Golden Sapling's +1
	 * is one more generated. Conditional ones are left out — the logging camp reduces the winter
	 * consumption "as long as the camp is in operation", which is not a thing the sheet can know, and
	 * the system's standing rule is that a condition it cannot evaluate is stated and never applied.
	 *
	 * Static as well as a getter because `buildSeasonSteps` needs the answer BEFORE the step exists:
	 * a step that rolls folds this into its dice, and the roll is built to construct the step with.
	 */
	static resultDeltaOf(results = [], contribution = null) {
		return results
			.filter(line => !line.isConditional)
			.reduce((total, line) => total + (line.adjustment.amount ?? 0), 0)
			// The mill's +1 at the harvest, the town's Population+1 in spring: the same arithmetic
			// arriving by a different route — what the steading adds to what this step pays out.
			+ (contribution?.delta ?? 0);
	}

	get resultDelta() { return SeasonStepSnapshot.resultDeltaOf(this.results, this.contribution); }

	/**
	 * The part of it the dice do NOT already carry.
	 *
	 * A step that rolls has it in its bonus — the total on the dice is the Surplus that moves, which
	 * is the one number the table should have to read. A step with no dice of its own has nowhere to
	 * put it, and its whole amount is this.
	 */
	get unrolledDelta() { return this.roll?.die ? 0 : this.resultDelta; }

	/** What the step actually moves for a rolled total — never below nothing at all. */
	amountFor(total) { return Math.max(0, total + this.unrolledDelta); }

	/**
	 * What a step with no dice of its own pays — the whole of what the steading's improvements bring.
	 *
	 * Stated on the control, because a step the move does not itself number has no line of the book's
	 * saying what it comes to: "Generate 3 Surplus" IS the sentence there.
	 */
	get gainTotal() { return this.amountFor(0); }

	/**
	 * Whether this step MOVES Surplus, and so carries a control: the dice it rolls, or — for the step
	 * the sheet adds in a season whose move generates nothing of its own — the amount it simply pays.
	 *
	 * A step whose only clauses are conditional pays nothing and offers nothing: the sheet cannot know
	 * whether the market was active, so it states the clause and leaves the table to it.
	 */
	get movesSurplus() {
		return Boolean(this.roll?.die) || (Boolean(this.affects) && this.gainTotal > 0);
	}
}

/**
 * What the steading's SIZE makes of a step's dice — winter's 1d2 in a hamlet, 1d4 in a village,
 * 2d6 in a town.
 *
 * Read under the step, because the step's own line is the book's and says 1d4: a control offering
 * 2d6 under a sentence that says 1d4, with nothing between them, is the sheet appearing to disagree
 * with the move it is drawing. Never a control of its own — it changes the dice the step already
 * rolls, and the step's control rolls them.
 */
export class SizeRoll {
	constructor({ size, die, statLabelKey = null }) {
		this.size         = size;
		this.die          = die;
		this.statLabelKey = statLabelKey;
	}

	/** The tier's own word, translated where the ledger and the size pill translate it. */
	get sizeLabelKey() { return `stonetop.steading.tier.size.${this.size}`; }
	get labelKey()     { return "stonetop.steading.seasons.steps.sizeRoll"; }
}

/**
 * One result row of the season's own roll: the move's authored tier, and everything this steading
 * brings to it.
 *
 * The same questions a step answers — what it rolls, which way that moves Surplus, what it has
 * already done — because the roll is the same roll. `rollSeasonStep` takes either and never asks
 * which it has.
 *
 * What it does NOT answer is adjustments. An improvement binds to one step of the season through
 * `SeasonProcedure.indexFor`, and for winter that is its opening consumption, so a stone wall
 * reduces the winter roll and leaves the 7-9's second roll at what the dice say. That is the book's
 * own ambiguity ("suffer the consequences as above") left where the book leaves it, rather than the
 * sheet quietly deciding it twice over.
 */
export class SeasonTierSnapshot {
	constructor({ result, address, roll = null, applied = null, outcomes = [], rolled = false }) {
		this.result  = result;
		this.address = address;
		this.roll    = roll;
		this.applied = applied;
		// Whether the season's own roll landed HERE. What makes the three rows a reading of the dice
		// rather than a reprint of the move: the table rolls 2d6+Fortunes and the row they are living
		// with is the one that lights up, with the other two still readable beside it.
		this.rolled  = rolled;
		// What the steading has BUILT that waits on the roll landing here — "the steading generates 1
		// Surplus, if you roll a 7+ with Fortunes". Under the row rather than beside the step, because
		// the row is the condition: a clause that reads "only if you roll a 7+" under the 10+ it is
		// printed inside is the qualifier saying what the row has just said. A 7+ is two rows, and it
		// is stated under both — whichever the dice land on is the one anybody reads.
		this.outcomes = outcomes;
	}

	get hasOutcomes() { return this.outcomes.length > 0; }
	get isRolled()    { return this.rolled; }

	/**
	 * The clauses this row can WRITE, and the ones it can only state.
	 *
	 * An outcome is not a condition the sheet cannot judge — the reader judges it by pressing the
	 * button on the row the dice landed on — so a plain payout here carries the same Apply every
	 * other result gets. What it cannot write (fiction, a rolled amount) is stated beside it.
	 */
	get writableOutcomes() { return this.outcomes.filter(line => line.isOutcomeArithmetic); }
	get statedOutcomes()   { return this.outcomes.filter(line => !line.isOutcomeArithmetic); }

	get key()       { return this.result.key; }
	get label()     { return this.result.label; }
	get text()      { return this.result.text; }
	get affects()   { return this.result.affects; }
	get rollsDice() { return this.result.rollsDice; }

	get die()          { return this.roll?.die ?? null; }
	get stat()         { return this.roll?.stat ?? null; }
	get statLabelKey() { return this.roll?.statLabelKey ?? this.result.statLabelKey ?? null; }
	/** Always null — nothing bends a tier's own roll — but the shared control asks both for it. */
	get modifierLabel() { return this.roll?.modifierLabel ?? null; }
	/** The control's fallback wording, for the same reason a step has one: a row always has words. */
	get labelKey()     { return "stonetop.steading.seasons.steps.rollFormula"; }

	/** What the tier actually moves for a rolled total — never below nothing at all. */
	amountFor(total) { return Math.max(0, total); }
}

/**
 * A season's steps, and what none of them claimed — the adjustments, and the moments.
 *
 * The leftovers travel with the steps because they are the same question asked of the same season:
 * the Golden Sapling bends generation in a season with nothing to generate, and its clause still has
 * to be readable somewhere.
 */
export class SeasonSteps {
	constructor(steps = [], adjustments = null, moments = []) {
		this.steps       = steps;
		this.adjustments = adjustments;
		this._moments    = moments;
	}

	/**
	 * The moments no step of this season numbers — the gathering at the inn, the aurochs hunt in a
	 * spring whose move does not name it.
	 *
	 * Only these keep a panel of their own. A moment the move DOES number is part of that step: it is
	 * rolled there and paid there, and a panel repeating it below was the same harvest offered twice.
	 */
	get unclaimedMoments() {
		const claimed = new Set(this.steps.map(step => step.contribution?.momentKey).filter(Boolean));
		return this._moments.filter(moment => !claimed.has(moment.key));
	}

	/**
	 * What one address addresses: a step, or one of its result rows.
	 *
	 * Takes the address in any of the forms it travels in — the object, a stored key, a bare index —
	 * because the store, the template and the tests each hold it in a different one, and taking it
	 * apart belongs to the address rather than to each of them.
	 */
	at(target) {
		const address = SeasonStepAddress.parse(target);
		const step    = address ? this.steps[address.index] ?? null : null;
		if (!step || !address.isTier) return step;
		return step.tierFor(address.tier);
	}

	get isEmpty() { return this.steps.length === 0; }
}

/**
 * The one place a season's steps are assembled — used by the tab's snapshot and by the roll itself,
 * so what the control offers and what the roll performs cannot drift apart.
 */
export function buildSeasonSteps({ procedure = null, statement = null, applied = {}, pick = null,
                                   moments = [], size = null, outcome = null } = {}) {
	const gains    = statement?.gains ?? [];
	// Somewhere to pay the steading's own gains, in a season whose move generates nothing of its own.
	// Added to the PROCEDURE rather than to the steps below it, so the step is numbered like any
	// other and so what bends the season's generation — the Golden Sapling's +1 — finds it.
	const measure  = gains.length ? (procedure?.withGenerationStep() ?? null) : procedure;
	const adjustments = new SeasonAdjustments(statement?.adjustments ?? [], measure);
	const outcomes    = statement?.outcomeGated ?? [];
	const steps = (measure?.steps ?? []).map((step, index) => {
		// What the steading brings to this step — the mill at the harvest, the town's Surplus where
		// the season generates. Read before the roll is built, because the dice it adds are part of
		// the roll the control offers.
		const contribution = StepContribution.forMoment(step, moments)
			?? StepContribution.forGains(step, gains);
		// The dice BEFORE any improvement: winter's are the steading's Size's, and Township's clause
		// about a town's 2d6 is what a town rolls because it is a town.
		const sized  = step.dieFor?.(size) ?? null;
		// What the step's results make it pay, folded into the dice rather than taken off the total
		// afterwards: the number the table watches is the Surplus that moves. A step with no dice of
		// its own keeps it — see `unrolledDelta`.
		const results = adjustments.resultsFor(index);
		const roll = adjustments.rollFor(step, index, sized)
			.withExtraDice(contribution?.dice ?? [], contribution?.sources ?? [])
			.withResultDelta(SeasonStepSnapshot.resultDeltaOf(results, contribution),
				[...results.filter(line => !line.isConditional).map(line => line.source),
					...(contribution?.sources ?? [])]);
		return new SeasonStepSnapshot({
			step,
			index,
			contribution,
			sizeRoll: sized && sized !== step.die
				? new SizeRoll({ size, die: sized, statLabelKey: step.statLabelKey })
				: null,
			// A step rolls where it or something it carries names dice. The move's OWN roll is not one
			// of them: it posts a card and moves nothing, which is why it names no die here.
			roll: !step.isTieredRoll && roll.die ? roll : null,
			adjustments: adjustments.linesFor(index),
			results,
			applied:  applied?.[String(index)] ?? null,
			pick:     step.isPick ? pick : null,
			tiers:    buildTiers(step, index, applied, step.isTieredRoll ? outcomes : [], outcome),
		});
	});
	return new SeasonSteps(steps, adjustments, moments);
}

/**
 * The result rows of one step — the move's tiers, each with its own record and its own dice.
 *
 * Its own roll rather than the step's: a tier that rolls is rolling for itself, and the step above
 * it may roll nothing at all (the tiered roll is 2d6+Fortunes, which the sheet posts as a move card
 * and never spends Surplus on).
 */
function buildTiers(step, index, applied, outcomes, outcome = null) {
	return (step.results ?? []).map(result => {
		const address = SeasonStepAddress.of(index, result.key);
		return new SeasonTierSnapshot({
			result,
			address,
			// The tier the season's own roll landed in, where it has been rolled at all. One row at
			// most: the keys are the three the roll resolves to.
			rolled: result.key === outcome,
			roll:    result.rollsDice ? new AdjustedStepRoll({ die: result.die, stat: result.stat }) : null,
			applied: applied?.[address.key] ?? null,
			// Every clause whose range covers this row. "7+" covers two of them, so the line is read
			// under the 10+ and under the 7-9 both.
			outcomes: outcomes.filter(line => line.firesOnTier(result.key)),
		});
	});
}
