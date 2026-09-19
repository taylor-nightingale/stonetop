/**
 * The steps of the Level Up move, as the move itself carries them.
 *
 * Same arrangement as the Seasons Change moves (see SeasonProcedure) in one respect and a
 * deliberate departure in another. Like them, the move item carries a `steps` array naming what the
 * sheet can act on. Unlike them, a step carries NO words of its own: Level Up's description is a
 * bulleted list of exactly these six steps, so the words are lifted from it (MoveBullets) and paired
 * here, position for position.
 *
 * That is why: `system.steps[].text` is a translatable path, and the four Seasons Change moves —
 * which do author their step text — ship every one of those strings blank in German beside a fully
 * translated description. Asking a translator the same sentence twice gets it answered once. This
 * move can avoid the question entirely because its description IS its procedure; theirs are not,
 * which is why the same trick does not reach them.
 *
 * Six steps, three of which the sheet can do something about and three of which it can only point
 * at. Each is its own concrete class answering the same few questions; nothing is shared by
 * inheritance, so no step is half-defined by a parent.
 */

/**
 * "Subtract 6 + twice your current level from your XP", and "Increase your level by 1".
 *
 * Two of the book's bullets, one class, because they are one act: the strip performs both behind a
 * single control, and the sheet has already printed the threshold as `19 / 16` above. Restating it
 * as "6 + twice your current level" is the formula the reader has just been shown the answer to, so
 * this pair is the one place the strip labels itself rather than quoting the book — which is also
 * why it takes no bullet.
 *
 * Both bullets are still steps in the pack, so the list there stays a faithful mirror of the book's
 * six. Merging them is a presentation decision, and it is made where the rows are built.
 */
export class SpendStep {
	get kind()          { return "spend"; }
	get isAdvancement() { return true; }
	/** Labelled by the sheet, so nothing pairs a bullet with it. */
	get labelKey()      { return "stonetop.character.levelUp.advanceStep"; }
}

/** The second half of the pair above — present so the pack's list still matches the book's, and
 *  folded into the same row when the rows are built. */
export class AdvanceStep {
	get kind()          { return "advance"; }
	get isAdvancement() { return true; }
}

/** "Choose a new move from your playbook, or an insert class that you've unlocked." */
export class ChooseMoveStep {
	constructor({ tab = "moves" } = {}, text = null) {
		this.text = text;
		this.tab  = tab;
	}

	get kind()      { return "chooseMove"; }
	get isCounted() { return true; }
}

/**
 * "If you are the Blessed (or have a sacred pouch) … increase your maximum Stock by 1."
 *
 * Both halves of the condition are answered by the same question — does this character carry the
 * possession? — because the Blessed's pouch IS that possession, granted by the playbook. So the
 * step names the slug and nothing here has to know which playbook anyone is.
 */
export class StockStep {
	constructor({ possession = null } = {}, text = null) {
		this.text       = text;
		this.possession = possession;
	}

	get kind()        { return "stock"; }
	get isEvenLevel() { return true; }
	/** The sheet already does this one: the possession's `scaling.perEvenLevel` raises the maximum on
	 *  its own, so the row reports what changed rather than offering a control. */
	get isAutomatic() { return true; }
}

/**
 * "If you are the Lightbearer (or have Invoke the Sun God) … choose a new Invocation."
 *
 * `startsKnowing` is how many a Lightbearer begins with (2). It lives on the step because the only
 * other place it is written is prose in the Invocations insert's description, which nothing can
 * count from.
 */
export class InvocationStep {
	constructor({ insert = null, group = null, startsKnowing = 0 } = {}, text = null) {
		this.text          = text;
		this.insert        = insert;
		this.group         = group;
		this.startsKnowing = Number(startsKnowing) || 0;
	}

	get kind()        { return "invocation"; }
	get isEvenLevel() { return true; }
	get isCounted()   { return true; }
}

/** "Review your Instinct and Appearance." Nothing observable happens when you have: a review that
 *  changed nothing is a review all the same, so this row never ticks and never counts as owed. */
export class ReviewStep {
	constructor({ tab = "playbook" } = {}, text = null) {
		this.text = text;
		this.tab  = tab;
	}

	get kind() { return "review"; }
}

const KINDS = {
	spend:      ()             => new SpendStep(),
	advance:    ()             => new AdvanceStep(),
	chooseMove: (raw, text)    => new ChooseMoveStep(raw, text),
	stock:      (raw, text)    => new StockStep(raw, text),
	invocation: (raw, text)    => new InvocationStep(raw, text),
	review:     (raw, text)    => new ReviewStep(raw, text),
};

/**
 * The one place a step's `kind` becomes a class. An unknown kind is dropped rather than rendered
 * blank — a row the reader cannot act on and the sheet cannot explain is worse than no row.
 */
export class LevelUpStep {
	static from(raw, text = null) {
		return KINDS[raw?.kind]?.(raw, text) ?? null;
	}
}

export class LevelUpProcedure {
	constructor(steps = []) {
		this.steps = steps;
	}

	/**
	 * The steps the move carries, paired with the move's own words for them.
	 *
	 * Positional, because the pack's list and the description's bullets are the same list — which is
	 * exactly why the pairing is made ONLY when the two are the same length. A GM who edits a bullet
	 * out of the description shifts every step below it onto the wrong sentence, and a step labelled
	 * with the next step's words is worse than a step with none: the rows still carry their figures
	 * and their controls, so the strip degrades to a checklist rather than lying about the book.
	 *
	 * Empty where the move carries no steps — a pack built before the procedure existed. The strip
	 * renders nothing in that case rather than inventing the book's own list, which is the one thing
	 * it must not do.
	 *
	 * @param {object[]} steps    the move's `system.steps`
	 * @param {RichText[]} bullets  MoveBullets.from(the move's description)
	 */
	static from(steps = [], bullets = []) {
		const raw    = Array.isArray(steps) ? steps : [];
		const paired = raw.length > 0 && raw.length === bullets.length;
		return new LevelUpProcedure(raw
			.map((step, index) => LevelUpStep.from(step, paired ? bullets[index] : null))
			.filter(Boolean));
	}

	get isEmpty() { return this.steps.length === 0; }
}
