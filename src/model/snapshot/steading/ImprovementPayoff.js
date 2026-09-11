/**
 * What an improvement gives you, in the book's own two halves.
 *
 * The book writes every improvement's payoff as two sentences — "When you ***meet the requirements***,
 * increase Fortunes by 1 and add any new homes to the map. **Henceforth**, when you consume Surplus
 * in winter, consider Population to be 1 lower than it is." — and `system.effects` carries that
 * split as `trigger.isCompletion`, sharpened by whether the clause states its own trigger. So the
 * card renders two headed groups rather than one list.
 *
 * The heading states the trigger for the clauses that do not state their own; the rest open with the
 * book's own "when …", which is why a clause carrying one belongs under Henceforth however it fires.
 *
 * Two statements rather than one with a filter, because they answer to different rules: the
 * completion half is the card's to apply, and the Henceforth half is `stated` — its results fire at
 * the turn of the season, and the season's own panel is where the table writes them. That is a fact
 * about the statement, not about each line, so it belongs on the statement.
 */
import { TurnoverLine, TurnoverStatement } from "./TurnoverStatement.js";

export class ImprovementPayoff {
	constructor({ completion, henceforth }) {
		this.completion = completion;
		this.henceforth = henceforth;
	}

	/**
	 * Split one improvement's results into the two halves.
	 *
	 * The caller supplies what it knows about a particular steading — which boxes are ticked, what the
	 * ratings stand at, what has already been written — and a caller that knows none of that supplies
	 * none of it. That is the whole difference between a steading's card and the catalog's.
	 *
	 * @param improvement  the SteadingImprovement
	 * @param boxes        this steading's RequirementBoxes; omit for a steading that has ticked nothing
	 * @param ratings      current values, so the statement can say before → after
	 * @param recordFor    (effect, id) -> AppliedEffect | null
	 * @param stated       nothing here is applied, whichever half it is in
	 */
	static from(improvement, { boxes = null, ratings = {}, recordFor = () => null, stated = false } = {}) {
		// The improvement builds its own empty tick state: a requirement is asked whether it is met by
		// a RequirementBoxes and not by a bare object, and a `{}` default put a plain one in its hands.
		const ticked = boxes ?? improvement.boxesFrom({});
		const completion = [], henceforth = [];
		for (const { effect, index } of improvement.effects.entries()) {
			const id = TurnoverLine.idFor(improvement.slug, index);
			const line = new TurnoverLine({
				id, source: improvement.name, effect,
				earned:  effect.holds(ticked),
				applied: recordFor(effect, id),
			});
			// Split on whether the clause STATES ITS OWN TRIGGER, not on `kind` alone. The palisade's
			// "when you take advantage of the palisade" is stored as completion-triggered because it
			// holds from the moment the palisade stands — but the book prints it under Henceforth, and
			// under "When you meet the requirements:" it now reads as a second "when" inside the first.
			// Nothing the sheet can apply carries a phrase, so no line loses a control by moving.
			(effect.trigger.isCompletion && !effect.trigger.phrase ? completion : henceforth).push(line);
		}
		return new ImprovementPayoff({
			completion: new TurnoverStatement(completion, ratings, { stated }),
			// Always stated: these fire at the turn of the season, and the season's own panel is where
			// the table writes them. A control here would pay them early and then again in the season
			// that owns them.
			henceforth: new TurnoverStatement(henceforth, ratings, { stated: true }),
		});
	}

	/**
	 * The payoff as the CATALOG states it — the improvement item's own sheet, with no steading behind
	 * it.
	 *
	 * Nothing is ticked, so nothing is earned; nothing has been applied; and nothing is applicable,
	 * because there is no steading to write to. A control here would carry an action the item sheet
	 * does not define, and pressing it would do nothing at all.
	 */
	static forCatalog(improvement) {
		return ImprovementPayoff.from(improvement, { stated: true });
	}

	get hasCompletion() { return !this.completion.isEmpty; }
	get hasHenceforth() { return !this.henceforth.isEmpty; }

	/** Nothing to show at all — a custom improvement with no modelled results. */
	get isEmpty() { return !this.hasCompletion && !this.hasHenceforth; }

	/**
	 * The steading has finished the work and not yet taken what it is owed.
	 *
	 * What the board reads to mark a card as wanting attention. Deliberately not "is complete": an
	 * improvement whose completion is all fiction — Township changing Size, Roadbuilding letting you
	 * build roads — owes nothing the sheet can write, and a card claiming otherwise would be asking
	 * for a click that does nothing.
	 */
	get isOwed() { return this.completion.willChangeAnything; }

	/** Everything the sheet could write on completion has been written. */
	get isTaken() { return this.completion.isFullyApplied; }
}
