import { SteadingDefaults } from "../../model/data/steading/SteadingDefaults.js";
import { RollModeNote, RollModeNotes } from "../../model/snapshot/steading/RollModeNote.js";

/**
 * Why each of the steading's moves might not roll a flat 2d6 — the reminders its rows carry.
 *
 * Its own class because neither half owns the question: an improvement knows nothing about *diminished*
 * and a debility has never heard of a township, yet Deploy can be spoken for by both at once. And
 * because the answer is a REMINDER — it changes no roll, so it has no business inside SteadingRolls,
 * which resolves one.
 *
 * Advantage is deliberately not applied anywhere. Four of the book's five advantage clauses wait on
 * fiction the sheet cannot see, the roll-mode control is the table's, and a sheet that decides for you
 * is what this system does not build. See MoveAdvantage.
 */
export class SteadingRollNotes {
	constructor(actor, improvements, debilities) {
		this._actor        = actor;
		this._improvements = improvements;
		this._debilities   = debilities;
	}

	/**
	 * slug → RollModeNotes, for every move anything has something to say about.
	 *
	 * Moves nothing speaks for are absent rather than present and empty, so a caller asking about an
	 * ordinary move gets nothing to draw without having to check whether it is empty.
	 */
	async bySlug() {
		const notes = new Map();
		const add = (slug, note) => notes.set(slug, [...(notes.get(slug) ?? []), note]);

		for (const { slug, note } of await this._advantages()) add(slug, note);
		for (const { slug, note } of this._hindrances())        add(slug, note);

		return new Map([...notes].map(([slug, list]) => [slug, new RollModeNotes(list)]));
	}

	/**
	 * The advantage every BUILT improvement entitles the steading to.
	 *
	 * Filtered by whether the clause's own requirement holds: an unbuilt township entitles Stonetop to
	 * nothing, and a reminder of what it would be owed belongs on the improvement's card, not on the
	 * move it would apply to.
	 */
	async _advantages() {
		const stored = this._actor.system?.improvementValues ?? {};
		const found  = [];
		for (const improvement of await this._improvements.owned()) {
			const boxes = improvement.boxesFrom(stored[improvement.slug] ?? {});
			for (const effect of improvement.effects.all()) {
				if (!effect.advantage || !effect.holds(boxes)) continue;
				for (const slug of effect.advantage.moves) {
					found.push({ slug, note: new RollModeNote({
						// The improvement's own clause, not a second wording of it: the note says which fiction
					// the entitlement waits on, and the card beside it is already saying exactly that.
					mode: "adv", source: improvement.name, clause: effect.trigger.phrase,
					}) });
				}
			}
		}
		return found;
	}

	/**
	 * What an active debility costs, by the moves the book names.
	 *
	 * *diminished* does hinder its three moves for real — SteadingRolls flips the die for it — so this
	 * note is the sheet finally SAYING so. It used to change the roll with nothing anywhere explaining
	 * why, which is the same complaint as advantage nobody could see.
	 */
	_hindrances() {
		return SteadingDefaults.debilities
			.filter(def => this._debilities.isActive(def.slug))
			.flatMap(def => def.hindersMoves.map(slug => ({
				slug,
				note: new RollModeNote({
					mode:     "dis",
					source:   game.i18n.localize(`stonetop.steading.debilities.${def.slug}.name`),
					// The one note on the row that is not an offer: SteadingRolls really does flip this die.
					enforced: true,
				}),
			})));
	}
}
