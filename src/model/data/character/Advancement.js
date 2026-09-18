/**
 * The arithmetic of Level Up (Book I, p.81), and nothing else.
 *
 * Every number the move names is derived from two stored values — the character's level and their
 * XP — so they live here as one small pure object rather than being recomputed at each of the four
 * places that wants one. Foundry-free, so the whole of it is a table of cases in a test.
 *
 * The track has no ceiling: the move triggers at XP "equal to (or greater than)" the cost and
 * SUBTRACTS it, so excess carries over into the next level (and feeds Burn Brightly, which spends 2
 * XP once you are over the line).
 */
export class Advancement {
	constructor(level = 1, xp = 0) {
		this.level = Math.max(1, level);
		this.xp    = Math.max(0, xp);
	}

	/** "6 + twice your current level" — what this level-up costs. */
	get cost() { return 6 + this.level * 2; }

	get isReady() { return this.xp >= this.cost; }

	/** What the track reads after the subtraction. */
	get xpAfter() { return Math.max(0, this.xp - this.cost); }

	/**
	 * The level this ceremony is ABOUT: the one being bought while the XP is there, and the one just
	 * bought once it has been spent.
	 *
	 * Both of the move's even-level clauses ask about "your new level", and the strip is read from
	 * both sides of the Advance button — before it, to see what this level will bring, and after it,
	 * to finish what it brought.
	 */
	get newLevel() { return this.isReady ? this.level + 1 : this.level; }

	/** Whether the even-level clauses (Stock, a new Invocation) fire for this level-up. */
	get newLevelIsEven() { return this.newLevel % 2 === 0; }

	/**
	 * How many moves a character of this level has chosen for themselves: one per level gained, so a
	 * level 5 character has picked 4 on top of whatever their playbook started them with.
	 */
	get expectedChosenMoves() { return this.level - 1; }

	/**
	 * How many Invocations a Lightbearer of this level knows: the two they start with, plus one for
	 * each even level reached. Counted from the CURRENT level, so the row only falls behind once the
	 * level has actually been bought.
	 */
	expectedInvocations(startsKnowing = 0) {
		return Math.max(0, startsKnowing) + Math.floor(this.level / 2);
	}
}
