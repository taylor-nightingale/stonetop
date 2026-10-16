/** The move that explains the roll modes, linked from the roll dialog (D9). */
export class RollRule {
	static ADVANTAGE_SLUG = "advantage-disadvantage";

	constructor(slug, name) {
		this.slug = slug;
		this.name = name;
	}
}

/** What the roll dialog picked. `stat` is null when the prompt named the stat itself. */
export class RollChoice {
	constructor(stat, rollMode) {
		this.stat     = stat;
		this.rollMode = rollMode;
	}
}

/**
 * What the roll dialog shows: the roll and who makes it, the stat it adds (or the stats to choose
 * from, for a move that rolls "ask"), and what bears on the mode.
 */
export class RollPrompt {
	static DICE = "2d6";

	constructor({ title, rollerName, rollerNote = null, stat = null, choices = [], notes = null, rule = null }) {
		this.title      = title;
		this.rollerName = rollerName;
		this.rollerNote = rollerNote;
		this.stat       = stat;
		this.choices    = choices;
		this.notes      = notes;
		this.rule       = rule;
	}

	static forStat(title, stat, extras = {}) {
		return new RollPrompt({ ...extras, title, stat });
	}

	static forChoice(title, choices, extras = {}) {
		return new RollPrompt({ ...extras, title, choices });
	}

	get choosesStat() {
		return this.choices.length > 0;
	}

	get dice() {
		return RollPrompt.DICE;
	}

	get formula() {
		return this.stat?.rollFormula ?? RollPrompt.DICE;
	}

	get hasNotes() {
		return Boolean(this.notes && !this.notes.isEmpty);
	}
}
