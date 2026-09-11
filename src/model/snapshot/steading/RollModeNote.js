import { rich } from "../RichText.js";

/**
 * Why a move might not roll a flat 2d6 — one entitlement or hindrance, and where it came from.
 *
 * A REMINDER, never a rule. The steading's roll-mode control belongs to the table, and nothing here
 * touches it: the book gives Stonetop advantage to Muster once it is a township, and whether the table
 * takes it on any given roll is theirs to say. What the sheet can do is stop anybody having to
 * remember which of six improvements said so.
 *
 * It has to READ that way too, which took three tries. Anything phrased in the row's own voice —
 * "Advantage", "Township gives advantage" — lands beside the name and the gloss, which are facts about
 * the move, and gets read as one more fact: that advantage is already on. So the line says what CAN be
 * done rather than what is true, and names the thing that permits it.
 *
 * The two modes are deliberately not symmetrical, because the rules are not. Advantage is offered and
 * never applied. A debility's disadvantage IS applied — SteadingRolls flips the die for it — so its
 * line says so, and saying "can be applied" there would be the only untrue thing on the row.
 *
 * `clause` is the fiction an entitlement waits on, in the book's own words — "when ***you take
 * advantage of the stone wall***". Four of the book's five advantage clauses carry one, which is the
 * plainest reason none of them may flip a die: the sheet cannot see whether it is true. It is the
 * improvement's own `when.phrase`, so the note and the improvement's card say it the same way.
 */
export class RollModeNote {
	constructor({ mode, source, clause = null, enforced = false }) {
		// "adv" | "dis" — the same two words the roll-mode control and the chat card already use, so
		// one concept is not named twice on one sheet.
		this.mode      = mode;
		// Display text, resolved by whoever built the note: an improvement's name, a debility's word.
		this.source    = source;
		// A RichText: the clause is markdown in the book's own emphasis, and wrapping it here is what
		// puts it in the enrich pass's way — see enrichRichTextTree.
		this.clause    = clause ? rich(clause) : null;
		// Whether the sheet already does this to the roll, as against offering it. True only for a
		// debility, and it is what picks the line's verb.
		this.enforced  = enforced;
	}

	get isConditional() { return Boolean(this.clause); }

	/** The word for this mode — the roll-mode control's own key, not a second copy of it. */
	get modeKey() { return `stonetop.rollMode.${this.mode}`; }

	/** The sentence this note makes: what can be done, or what already is. */
	get verdictKey() {
		return this.enforced
			? "stonetop.steading.rollNote.applies"
			: "stonetop.steading.rollNote.canApply";
	}
}

/** A move's notes, as a thing that can be asked what to draw. */
export class RollModeNotes {
	constructor(notes = []) {
		this._notes = notes;
	}

	get isEmpty() { return this._notes.length === 0; }

	/**
	 * Every note, one line each — no collapsing.
	 *
	 * A line names the improvement that permits it, which is what stops it reading as a state of the
	 * roll, and that is only possible one source at a time. Trade & Barter can draw on three
	 * improvements at once and then costs three lines; a mark that collapsed them read as a badge
	 * saying advantage was already on, which is worse than the height.
	 *
	 * A getter and not a method because a template reads it: Handlebars invokes a function it finds on
	 * a path with the WRONG receiver, so `{{#each notes.all}}` against a method throws inside the render.
	 */
	get all() { return [...this._notes]; }
}
