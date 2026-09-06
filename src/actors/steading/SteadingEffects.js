import { EFFECT_TARGETS } from "../../model/data/steading/ImprovementEffect.js";
import { AppliedEffect } from "../../model/data/steading/AppliedEffect.js";
import { ImprovementPayoff } from "../../model/snapshot/steading/ImprovementPayoff.js";
import { TurnoverLine, TurnoverStatement } from "../../model/snapshot/steading/TurnoverStatement.js";

/**
 * What the steading's improvements propose to do to it, and doing it.
 *
 * One class for both places results fire — an improvement's completion, and the turn of the season —
 * because they are the same act: gather the results that hold, show what they come to, and write.
 *
 * Two things it deliberately does NOT do. It never applies an advisory result: a die the table rolls,
 * a condition it cannot evaluate, an arithmetic that bends a step. And it never writes without being
 * asked — a statement is built for reading, and applying is a separate call.
 *
 * **Two stores, one id.** An improvement's COMPLETION is applied once, ever, and is recorded in
 * `system.improvementsApplied`; a turn or moment result fires every autumn and is recorded in
 * `system.turnoverApplied`, which is cleared when the wheel turns. Filing the Mill's harvest Surplus
 * in the durable store would pay it once and never again. What the two share is the line id and the
 * AppliedEffect record, which is enough for one pair of apply/revert methods to serve both — the
 * line's own trigger picks the store.
 */
export class SteadingEffects {
	constructor(actor, improvements) {
		this._actor        = actor;
		this._improvements = improvements;
	}

	get _stored() { return this._actor.system?.improvementValues ?? {}; }

	/** The steading's current ratings, so a statement can say before → after. */
	get _ratings() {
		const attributes = this._actor.system?.attributes ?? {};
		return Object.fromEntries(EFFECT_TARGETS.map(t => [t, attributes[t] ?? 0]));
	}

	/**
	 * Where a result's applied-record lives — durable for a completion, season-scoped for anything
	 * else. The one place that decision is made.
	 */
	static _storeFor(effect) {
		return effect.trigger.isCompletion ? "improvementsApplied" : "turnoverApplied";
	}

	_recordFor(effect, id) {
		const store = this._actor.system?.[SteadingEffects._storeFor(effect)] ?? {};
		return AppliedEffect.fromRaw(store[id]);
	}

	_lineFor(improvement, effect, index, { earned = true } = {}) {
		const id = TurnoverLine.idFor(improvement.slug, index);
		return new TurnoverLine({
			id, source: improvement.name, effect, earned, applied: this._recordFor(effect, id),
		});
	}

	/**
	 * The statement for one trigger.
	 *
	 * `firingAt` answers both halves at once — the result fires here AND its own requirement holds —
	 * so an unbuilt mill contributes nothing without a second check.
	 */
	async statementFor(kind, { season = null, moment = null } = {}) {
		const lines = [];
		for (const improvement of await this._improvements.owned()) {
			const values = this._stored[improvement.slug] ?? {};
			for (const { effect, index } of improvement.entriesFiringAt(kind, values, { season, moment })) {
				lines.push(this._lineFor(improvement, effect, index));
			}
		}
		return new TurnoverStatement(lines, this._ratings);
	}

	/**
	 * Everything ONE improvement does, in the book's own two halves.
	 *
	 * Unlike `statementFor`, this does not filter to what currently holds: the card has to state what
	 * an improvement WILL do before it is built, because the prose that used to say so has been
	 * stripped out of the pack. An unearned line is that promise, and carries no control.
	 */
	payoffFor(improvement) {
		return ImprovementPayoff.from(improvement, {
			boxes:     improvement.boxesFrom(this._stored[improvement.slug] ?? {}),
			ratings:   this._ratings,
			recordFor: (effect, id) => this._recordFor(effect, id),
		});
	}

	/** The line one id addresses, wherever it lives, or null. */
	async lineById(id) {
		const parsed = TurnoverLine.parseId(id);
		if (!parsed) return null;
		const improvement = (await this._improvements.owned()).find(i => i.slug === parsed.slug);
		const effect = improvement?.effects.all()[parsed.index];
		if (!effect) return null;
		const boxes = improvement.boxesFrom(this._stored[improvement.slug] ?? {});
		return this._lineFor(improvement, effect, parsed.index, { earned: effect.holds(boxes) });
	}

	/** Write one result, and record what it wrote. */
	async applyLine(id) {
		const line = await this.lineById(id);
		return line ? this.applyLines([line]) : false;
	}

	/**
	 * Write several results as ONE update.
	 *
	 * One update rather than one per line — six people share this document, and a run of writes is a
	 * run of renders for all of them, with a half-applied steading visible in between. This is also
	 * what the season's "apply all" is: not a different mechanism, just every pending line at once.
	 */
	async applyLines(lines) {
		const pending = lines.filter(l => l.isPending);
		if (!pending.length) return false;

		const update = {};
		const attributes = this._actor.system?.attributes ?? {};
		const assets     = this._actor.system?.assets ?? {};

		const ratings = new Map();
		const additions = new Map();
		for (const line of pending) {
			const record = AppliedEffect.fromLine(line);
			if (record.change) {
				const { target, amount } = record.change;
				ratings.set(target, (ratings.get(target) ?? attributes[target] ?? 0) + amount);
			}
			if (record.entry) {
				// Evidence lists are plain string arrays; an entry already written is not written twice,
				// since re-applying is a thing that happens on a shared sheet.
				const current = additions.get(record.entry.list) ?? [...(assets[record.entry.list] ?? [])];
				if (!current.includes(record.entry.text)) current.push(record.entry.text);
				additions.set(record.entry.list, current);
			}
			update[`system.${SteadingEffects._storeFor(line.effect)}.${line.id}`] = record.toRaw();
		}
		for (const [target, value] of ratings)  update[`system.attributes.${target}`] = value;
		for (const [list, items] of additions)  update[`system.assets.${list}`] = items;

		await this._actor.update(update);
		return true;
	}

	/**
	 * Take one result back, subtracting exactly what it wrote.
	 *
	 * The record is cleared with `-=`, because Foundry MERGES an object-field update rather than
	 * replacing it: assigning null would leave the key in place, reading back as an apply that cannot
	 * be undone.
	 */
	async revertLine(id) {
		const line = await this.lineById(id);
		if (!line?.canRevert) return false;
		await this._actor.update({
			...line.applied.inverseUpdate({
				attributes: this._actor.system?.attributes ?? {},
				assets:     this._actor.system?.assets ?? {},
			}),
			[`system.${SteadingEffects._storeFor(line.effect)}.-=${line.id}`]: null,
		});
		return true;
	}

	/** Apply every line a statement still owes. */
	async apply(statement) {
		return this.applyLines(statement.pending);
	}
}
