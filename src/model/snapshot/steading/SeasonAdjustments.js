import { EFFECT_STEPS } from "../../data/steading/ImprovementEffect.js";

/**
 * What this steading's improvements do to the season's own procedure, bound to the steps they bend.
 *
 * The model had one axis — consumption or generation — and the sheet rendered all four kinds of bend
 * as one undifferentiated list headed "when the steading consumes Surplus", nowhere near the step
 * that consumes. Township and Additional Housing change what you ROLL; Stone Wall and the Golden
 * Sapling change what you PAY once it is rolled. Those are different places in the same step, and
 * `at` is what tells them apart.
 *
 * The join is the `affects` each seasons move carries on its own steps: it says which side of the
 * season a step is, and `SeasonProcedure.indexFor` says which step that is.
 */

/**
 * The dice and the rating a step will actually roll, after what the steading has built.
 *
 * A die and a rating rather than a formula string, because that is the pair `rollSeasonStep` takes —
 * so the rating still resolves through resolveBonus, debilities and all, and there is no `@` path to
 * parse. The two deltas are the rest of it: Additional Housing does not change the formula, it
 * changes what Population counts as inside it (`termDelta`), and Stone Wall changes what the dice
 * come to once they land (`resultDelta`). Both are in the roll, so one number answers what the
 * season costs.
 */
export class AdjustedStepRoll {
	constructor({ die = null, stat = null, termDelta = 0, resultDelta = 0, sources = [], resized = false } = {}) {
		this.die       = die;
		this.stat      = stat;
		this.termDelta = termDelta;
		// What the step pays LESS (or more) once the dice land — Stone Wall's "1 less Surplus than
		// normal". Kept apart from `termDelta` because the two are different sentences and each still
		// reads as its own line under the step; they meet only in the arithmetic, where the roll adds
		// both so the total the table watches IS what the steading pays.
		this.resultDelta = resultDelta;
		// Whether the steading's SIZE already changed these dice before any improvement did — winter's
		// 2d6 in a town. Kept apart from `sources`, which are improvements by name: the size is not one
		// of them, and it says so under the step in its own words.
		this.resized   = resized;
		// The improvements that made it so, by name. Not rendered from here — each states itself, in
		// its own words, in the list under the step — but a roll has to know whether anything bent it,
		// because that is what decides whether the control names the dice at all. Deduped: one
		// improvement that both bends the dice and changes what they cost is one source, not two.
		this.sources   = [...new Set(sources)];
	}

	/**
	 * Whether these are not the dice the step's own line names — what puts the formula on the control
	 * rather than the bare verb. True of a town's winter as much as of a township's: the line says
	 * 1d4+Population either way, and a button reading "Roll" would leave the reader to guess.
	 */
	get isAdjusted()   { return this.resized || this.sources.length > 0; }
	get statLabelKey() { return this.stat ? `stonetop.steading.attr.${this.stat}` : null; }

	/**
	 * The same roll with more dice in it — Greater Harvest's 1d4 added to autumn's own 1d4.
	 *
	 * A new roll rather than a mutated one: this is built by `rollFor` and then handed to a control
	 * and to `rollSeasonStep`, and a builder's output that is poked at afterwards is a value nobody
	 * can trust to be the one the builder described.
	 */
	withExtraDice(dice = [], sources = []) {
		if (!dice.length) return this;
		return new AdjustedStepRoll({
			die:         [this.die, ...dice].filter(Boolean).join(" + "),
			stat:        this.stat,
			termDelta:   this.termDelta,
			resultDelta: this.resultDelta,
			sources:     [...this.sources, ...sources],
			resized:     this.resized,
		});
	}

	/**
	 * The same roll paying what the step's results make it pay — Stone Wall's −1 inside the dice.
	 *
	 * The book hooks those results AFTER the roll ("consumes 1 less Surplus than normal"), and the
	 * sheet used to as well: it rolled 2d6+Population and quietly paid one less. Two numbers for one
	 * cost, and the table had to read the applied line to find the one that mattered. Folded into the
	 * roll, the total on the dice is the Surplus that leaves the stores. What each improvement SAID is
	 * still read, unsummarised, in its own line under the step.
	 */
	withResultDelta(delta = 0, sources = []) {
		if (!delta) return this;
		return new AdjustedStepRoll({
			die:         this.die,
			stat:        this.stat,
			termDelta:   this.termDelta,
			resultDelta: this.resultDelta + delta,
			sources:     [...this.sources, ...sources],
			resized:     this.resized,
		});
	}

	/** The rating as this step counts it: resolveBonus answers what it IS, this what it counts as. */
	bonusFrom(resolved) { return resolved + this.modifier; }

	/** Everything this roll adds beyond the rating itself — what the control has to print. */
	get modifier() { return this.termDelta + this.resultDelta; }

	/**
	 * The modifier as a reader sees it — "− 2" — or null where there is nothing to print.
	 *
	 * A true minus sign, because this is prose on a button and not an expression: "2d6 + Population
	 * − 2" is the formula the table is being offered. `expressionFrom` is the other half, and it
	 * writes ASCII because Foundry has to parse it.
	 */
	get modifierLabel() {
		return this.modifier ? `${this.modifier < 0 ? "\u2212" : "+"} ${Math.abs(this.modifier)}` : null;
	}

	/** The dice expression for a rating that resolved to this — what Foundry evaluates. */
	expressionFrom(resolved) {
		const bonus = this.bonusFrom(resolved);
		return bonus < 0 ? `${this.die} - ${Math.abs(bonus)}` : `${this.die} + ${bonus}`;
	}
}

/**
 * The results that bend one side of a season, for a season with no step to hang them on.
 *
 * The Golden Sapling generates +1 whenever the steading generates at all, and spring and winter have
 * no generation step — so its clause still has to be readable somewhere. Headed by the STEP rather
 * than left in the general list, which is the whole point: it is not what the season pays out, it is
 * how the season's arithmetic works for this steading.
 */
export class AdjustmentGroup {
	constructor(step, lines) {
		this.step  = step;
		this.lines = lines;
	}

	/** "When the steading consumes Surplus" — the step named in the book's own terms. */
	get labelKey() { return `stonetop.steading.effects.step.${this.step}`; }

	/** Grouped in the order the steps are named, and only the steps something actually bends. */
	static groupsFor(lines) {
		return EFFECT_STEPS
			.map(step => new AdjustmentGroup(step, lines.filter(l => l.adjustment.step === step)))
			.filter(group => group.lines.length);
	}
}

export class SeasonAdjustments {
	/**
	 * @param lines      the statement's adjusting lines — each an improvement and one StepAdjustment
	 * @param procedure  the season's own SeasonProcedure, which says where each one lands
	 */
	constructor(lines = [], procedure = null) {
		this._rollLines = new Map();
		this._results   = new Map();
		this._unclaimed = [];

		for (const line of lines) {
			const index  = procedure?.indexFor(line.adjustment.step) ?? null;
			const step   = Number.isInteger(index) ? procedure.steps[index] : null;
			const bucket = step ? SeasonAdjustments._bucketFor(step, line.adjustment) : null;
			if (!bucket) { this._unclaimed.push(line); continue; }
			const map = bucket === "result" ? this._results : this._rollLines;
			map.set(index, [...(map.get(index) ?? []), line]);
		}
	}

	/**
	 * Where one adjustment lands on the step it names, or nowhere.
	 *
	 * Nowhere is a real answer and not a failure: a formula adjustment against a step that rolls
	 * nothing, or a term adjustment naming a rating that step does not add, would silently change
	 * neither — so it goes to the general list instead of being swallowed by a control it cannot
	 * reach.
	 */
	static _bucketFor(step, adjustment) {
		if (adjustment.isResult) return "result";
		if (!step.rollsDice) return null;
		if (adjustment.isTerm && adjustment.term !== step.stat) return null;
		return "roll";
	}

	/**
	 * The roll this step actually makes. Always an AdjustedStepRoll, adjusted or not — the step's own
	 * dice are the answer when nothing bends them, so one shape serves the control either way.
	 *
	 * `baseDie` is what the step rolls BEFORE any improvement touches it — winter's dice by the
	 * steading's Size. Passed in rather than read off the step, because the step knows the table and
	 * not which row of it this steading is on.
	 */
	rollFor(step, index, baseDie = null) {
		let die = baseDie ?? step.die ?? null, stat = step.stat ?? null, termDelta = 0;
		const sources = [];
		for (const line of this._rollLines.get(index) ?? []) {
			const adjustment = line.adjustment;
			if (adjustment.isFormula) {
				die  = adjustment.die  ?? die;
				stat = adjustment.stat ?? stat;
			} else {
				termDelta += adjustment.amount ?? 0;
			}
			sources.push(line.source);
		}
		return new AdjustedStepRoll({
			die, stat, termDelta, sources,
			resized: Boolean(baseDie && baseDie !== step.die),
		});
	}

	/** What this step actually pays, once it is rolled — Stone Wall's "1 less Surplus than normal". */
	resultsFor(index) { return this._results.get(index) ?? []; }

	/**
	 * Everything bending this step, in the order it bends it: what changes the dice first, then what
	 * changes what they cost.
	 *
	 * One list, because each of them is a sentence the book already wrote — "roll 2d6+Population
	 * instead of 1d4+Population", "consider Population to be 1 lower than it is", "consumes 1 less
	 * Surplus than normal" — and reading them under the step is what says how this steading's winter
	 * differs. The hooks are what the SHEET does with them, and the sheet says that by rolling the
	 * right dice, not by narrating its own summary of the clauses above.
	 */
	linesFor(index) { return [...(this._rollLines.get(index) ?? []), ...this.resultsFor(index)]; }

	/** The ones no step of this season claimed, for the general list to state. */
	get unclaimed()       { return [...this._unclaimed]; }
	get unclaimedGroups() { return AdjustmentGroup.groupsFor(this._unclaimed); }
}
