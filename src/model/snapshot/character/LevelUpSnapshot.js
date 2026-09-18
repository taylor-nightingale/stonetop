/**
 * The Level Up strip, as the sheet renders it: the move's own steps, each paired with what this
 * character brings to it.
 *
 * Nothing here is stored. A row knows it is done because the character's state says so — the XP is
 * spent, the move is ticked, the Invocation is known — exactly as a Seasons Change step reads the
 * steading rather than a "done" flag. A player who advances outside the strip (with the steppers, or
 * by ticking a move on the Moves tab) finds the strip already agrees with them.
 *
 * One concrete row class per step kind, each answering the same few questions. No base class: a row
 * that cannot say what it is is a row the partial draws blank.
 */

/**
 * "Subtract 6 + twice your current level from your XP", and "Increase your level by 1" — the book's
 * first two bullets, as one row.
 *
 * They are one act: the control performs both, and a failure between them would leave a character
 * who paid and did not advance. They also read as one line, because the second says nothing the
 * first has not: "Spend XP to level up" already says you are levelling up.
 *
 * This is the one row the strip labels in its own words rather than the move's. The book states the
 * threshold as a formula — "6 + twice your current level" — and the XP track three lines above has
 * already printed its answer as `19 / 16`, so quoting it here restates a sum the reader can see
 * done. Its `labelKey` comes off the step, so the words are a UI string, translated once with the
 * rest of the sheet rather than a second time as pack prose.
 *
 * The figures describe the level-up ABOUT to happen, so they are shown only while one is — see
 * `hasFigure`. Once the XP is spent they would describe the NEXT one, and a ticked-off row quoting
 * a cost the character cannot meet reads as the strip proposing a second advance.
 */
export class AdvanceRow {
	constructor(step, advancement) {
		this.step     = step;
		this.cost     = advancement.cost;
		this.xpBefore = advancement.xp;
		this.xpAfter  = advancement.xpAfter;
		this.from     = advancement.level;
		this.to       = advancement.level + 1;
		this.done     = !advancement.isReady;
	}

	get kind()     { return "advance"; }
	get text()     { return null; }
	get labelKey() { return this.step.labelKey; }
	// Only while there is a level to buy. The row stays on screen once it is done — the list is the
	// move's own, and a step that vanished would make the book's six read as five — but the control
	// goes, because pressing it again would spend XP the character no longer owes and hand them a
	// second level for it.
	get hasControl() { return !this.done; }
	get hasFigure()  { return !this.done; }
	get isOwed()     { return false; }
}

/**
 * "Choose a new move from your playbook, or an insert class that you've unlocked."
 *
 * Counted rather than remembered: a character has chosen one move per level gained, so `expected`
 * is level − 1 and `chosen` is what they actually carry beyond what a playbook or insert class
 * handed them. Advisory, like every count on this sheet — a GM who grants an extra move makes the
 * row read as done, which is the right way to be wrong.
 */
export class ChooseMoveRow {
	constructor(step, advancement, chosen) {
		this.step     = step;
		this.chosen   = chosen;
		this.expected = advancement.expectedChosenMoves;
		this.done     = chosen >= this.expected;
	}

	get kind()        { return "chooseMove"; }
	get text()        { return this.step.text; }
	get labelKey()    { return null; }
	get tab()         { return this.step.tab; }
	get tabLabelKey() { return `stonetop.sheet.tabs.${this.step.tab}`; }
	get tabLabel()    { return null; }
	get behind()      { return Math.max(0, this.expected - this.chosen); }
	get isOwed()      { return !this.done; }
}

/**
 * "…increase your maximum Stock by 1."
 *
 * The sheet already does this: the sacred pouch's `scaling.perEvenLevel` raises the maximum off the
 * level itself. So the row reports the two numbers and offers nothing to press — a control here
 * would be a second way to change a value that is not stored.
 */
export class StockRow {
	constructor(step, from, to) {
		this.step = step;
		this.from = from;
		this.to   = to;
		this.done = true;
	}

	get kind()        { return "stock"; }
	get text()        { return this.step.text; }
	get labelKey()    { return null; }
	get isAutomatic() { return true; }
	get changed()     { return this.to > this.from; }
	get isOwed()      { return false; }
}

/** "…choose a new Invocation." Counted the same way the move choice is: two to start with, one per
 *  even level, against what the insert's group actually has ticked. */
export class InvocationRow {
	constructor(step, advancement, known, insertName = null) {
		this.step       = step;
		this.known      = known;
		this.insertName = insertName;
		this.expected   = advancement.expectedInvocations(step.startsKnowing);
		this.done       = known >= this.expected;
	}

	get kind()     { return "invocation"; }
	get text()     { return this.step.text; }
	get labelKey() { return null; }
	// The insert's own tab, named by the insert's own name — the character sheet builds one tab per
	// owned insert item (see StonetopCharacterSheet#_getTabsConfig), so neither is a sheet label with
	// a key of its own.
	get tab()         { return `insert-${this.step.insert}`; }
	get tabLabelKey() { return null; }
	get tabLabel()    { return this.insertName; }
	get behind()      { return Math.max(0, this.expected - this.known); }
	get isOwed()      { return !this.done; }
}

/** "Review your Instinct and Appearance." A prompt, never a tick: a review that changed nothing
 *  happened all the same, and nothing on the character records that it did. */
export class ReviewRow {
	constructor(step) {
		this.step = step;
	}

	get kind()        { return "review"; }
	get text()        { return this.step.text; }
	get labelKey()    { return null; }
	get tab()         { return this.step.tab; }
	get tabLabelKey() { return `stonetop.sheet.tabs.${this.step.tab}`; }
	get tabLabel()    { return null; }
	get done()        { return false; }
	get isOwed()      { return false; }
}

/**
 * @property {string} gloss   the move's own trigger, lifted from its text — the strip's one line of
 *                            explanation, so nothing about when to level up is authored here
 * @property {LevelUpRow[]} rows
 */
export class LevelUpSnapshot {
	constructor(b) {
		this.gloss     = b._gloss ?? "";
		this.rows      = b._rows ?? [];
		this.level     = b._level;
		this.newLevel  = b._newLevel;
		this.cost      = b._cost;
		this.isReady   = b._isReady === true;
	}

	/** The steps still owed at the level the character is on — what keeps the strip reachable after
	 *  the XP has been spent and there is nothing left for the Advance control to do. */
	get owed() { return this.rows.filter(row => row.isOwed); }

	get hasOwed() { return this.owed.length > 0; }

	/** Whether the sheet offers the strip at all: the move has triggered, or it triggered earlier and
	 *  left something unfinished. Silent the rest of the time. */
	get isOffered() { return this.rows.length > 0 && (this.isReady || this.hasOwed); }
}

export class LevelUpSnapshotBuilder {
	withGloss(v)    { this._gloss    = v; return this; }
	withRows(v)     { this._rows     = v; return this; }
	withLevel(v)    { this._level    = v; return this; }
	withNewLevel(v) { this._newLevel = v; return this; }
	withCost(v)     { this._cost     = v; return this; }
	withIsReady(v)  { this._isReady  = v; return this; }
	build()         { return new LevelUpSnapshot(this); }
}
