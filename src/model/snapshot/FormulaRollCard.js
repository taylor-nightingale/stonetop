/**
 * A roll of stated dice as the chat card reports it.
 *
 * Not every roll a move calls for lands on 10+/7-9/6-. Winter's Seasons Change opens by rolling
 * 1d4+Population, and the answer is a QUANTITY — so the card has no tier to report and needs three
 * other things instead: what to call the roll, the formula in the words the sheet offered it in, and
 * what the roll did to the sheet that asked for it.
 *
 * A named object rather than a bag, because it crosses two layers: the steading builds it, the actor
 * carries it, and ActorRolling renders it.
 */
export class FormulaRollCard {
	constructor({ name, roll, formula = null, applied = null }) {
		this.name = name;
		// The evaluated Roll. Carried whole so the message can ship it and the dice animate.
		this.roll = roll;
		// "1d4 + Population" — the formula NAMED, as against the numbers it resolved to, which the
		// dice row prints beside it.
		this.formula = formula;
		// What the roll changed, where the caller applied it before reporting — an AppliedStepRoll.
		// Null for a roll that moved nothing.
		this.applied = applied;
	}
}
