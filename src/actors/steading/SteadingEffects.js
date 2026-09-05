import { EFFECT_TARGETS } from "../../model/data/steading/ImprovementEffect.js";
import { TurnoverLine, TurnoverStatement } from "../../model/snapshot/steading/TurnoverStatement.js";

/**
 * What the steading's improvements propose to do to it, and doing it.
 *
 * One class for both places results fire — an improvement's completion, and the turn of the season —
 * because they are the same act: gather the results that hold, show what they come to, let the table
 * drop any of them, then write once.
 *
 * Two things it deliberately does NOT do. It never applies an advisory result: a die the table
 * rolls, a condition it cannot evaluate, an arithmetic that bends a step. And it never writes without
 * being asked — the statement is built for review, and `apply` is a separate call.
 */
export class SteadingEffects {
	constructor(actor, improvements) {
		this._actor        = actor;
		this._improvements = improvements;
	}

	get _stored()   { return this._actor.system?.improvementValues ?? {}; }
	get _excluded() { return this._actor.system?.turnoverExcluded ?? {}; }

	/** The steading's current ratings, so a statement can say before → after. */
	get _ratings() {
		const attributes = this._actor.system?.attributes ?? {};
		return Object.fromEntries(EFFECT_TARGETS.map(t => [t, attributes[t] ?? 0]));
	}

	/**
	 * The statement for one trigger.
	 *
	 * `firingAt` answers both halves at once — the result fires here AND its own requirement holds —
	 * so an unbuilt mill contributes nothing without a second check.
	 */
	async statementFor(kind, { season = null, moment = null } = {}) {
		const excluded = this._excluded;
		const lines = [];
		for (const improvement of await this._improvements.owned()) {
			const values = this._stored[improvement.slug] ?? {};
			for (const { effect, index } of improvement.entriesFiringAt(kind, values, { season, moment })) {
				const id = TurnoverLine.idFor(improvement.slug, index);
				lines.push(new TurnoverLine({ id, source: improvement.name, effect, included: !excluded[id] }));
			}
		}
		return new TurnoverStatement(lines, this._ratings);
	}

	/**
	 * The completion statement for ONE improvement — what finishing it does.
	 *
	 * Per-improvement rather than for all of them at once, because this is offered on the card of the
	 * improvement that was just finished, where the last box was ticked.
	 */
	completionFor(improvement) {
		const values   = this._stored[improvement.slug] ?? {};
		const excluded = this._excluded;
		const lines = improvement.entriesFiringAt("completed", values).map(({ effect, index }) =>
			new TurnoverLine({
				id:       TurnoverLine.idFor(improvement.slug, index),
				source:   improvement.name,
				effect,
				included: !excluded[TurnoverLine.idFor(improvement.slug, index)],
			}));
		return new TurnoverStatement(lines, this._ratings);
	}

	/** Whether this improvement's completion has already been applied — it is owed once, ever. */
	isCompletionApplied(slug) {
		return Boolean((this._actor.system?.improvementsApplied ?? {})[slug]);
	}

	/** Apply an improvement's completion, and record that it is done. */
	async applyCompletion(improvement) {
		await this.apply(this.completionFor(improvement));
		await this._actor.update({ [`system.improvementsApplied.${improvement.slug}`]: true });
	}

	/** Leave one line out of what gets applied, or put it back. */
	async setIncluded(id, included) {
		await this._actor.update({ [`system.turnoverExcluded.${id}`]: !included });
	}

	/**
	 * Apply a statement: every rating delta summed into one update, and every list entry appended.
	 *
	 * ONE update rather than one per line — six people share this document, and a run of writes is a
	 * run of renders for all of them, with a half-applied steading visible in between.
	 */
	async apply(statement) {
		if (!statement.willChangeAnything) return false;

		const update = {};
		for (const total of statement.totals) update[`system.attributes.${total.target}`] = total.to;

		// Evidence lists are plain string arrays; an entry already written is not written twice, since
		// re-applying is a thing that happens on a shared sheet.
		const assets = this._actor.system?.assets ?? {};
		const additions = new Map();
		for (const entry of statement.listEntries) {
			const current = additions.get(entry.list) ?? [...(assets[entry.list] ?? [])];
			if (!current.includes(entry.text)) current.push(entry.text);
			additions.set(entry.list, current);
		}
		for (const [list, items] of additions) update[`system.assets.${list}`] = items;

		await this._actor.update(update);
		return true;
	}
}
