import { Seasons } from "../../model/data/steading/Seasons.js";
import { Impressions } from "../../model/data/steading/Impressions.js";
import { Moments } from "../../model/data/steading/Moments.js";
import { SeasonalPicks } from "../../model/data/steading/SeasonalPicks.js";
import { MomentSnapshot, SeasonSnapshot, TurnoverSnapshot } from "../../model/snapshot/steading/TurnoverSnapshot.js";

/**
 * Where the steading's wheel stands, and the turnover that moves it.
 *
 * Split from SteadingSeasons — which owns the seasons MOVE CATEGORY — because these are two jobs:
 * one is "which four moves are the seasonal ones", the other is "what season is it, and what happens
 * when that changes". The tab composes both.
 *
 * Turning the wheel is its own act, and a quiet one: it hands the steading the next season and
 * clears what the last one recorded. Rolling that season's Seasons Change is separate, and comes
 * after — the move is rolled from the section that describes it, by a steading already in it.
 */
export class SteadingSeason {
	constructor(actor, effects, choices) {
		this._actor   = actor;
		this._effects = effects;
		this._choices = choices;
	}

	get season() { return Seasons.byKey(this._actor.system?.season); }
	get year()   { return this._actor.system?.year ?? 1; }
	/** How big the steading is — what winter's dice are read from (1d2 / 1d4 / 2d6 by Size). */
	get size()   { return this._actor.system?.attributes?.size ?? null; }

	/** The book's own line for the season this steading is in — stamped when the wheel last turned. */
	get impression() { return this._actor.system?.seasonImpression ?? ""; }

	/**
	 * The tier this season's own Seasons Change roll landed in, or null while nobody has rolled it.
	 *
	 * Stored rather than held on the client that rolled: the sheet is open on six screens, and a
	 * result only the roller can see is a result the table has to say out loud to use.
	 */
	get rolledOutcome() { return this._actor.system?.seasonRollOutcome || null; }

	/**
	 * Remember what the season's own move came up, for the result row to say so.
	 *
	 * Only that move's roll. Every move the steading makes comes through here — the aurochs hunt,
	 * Trade & Barter — and the tier a hunt landed in says nothing about which of winter's three
	 * results the steading is living with. The season knows which move is its own, so the question
	 * is answered here rather than at each roll site.
	 *
	 * The latest roll wins. The box invites the table to roll the season as many times as it asks
	 * for, and what is highlighted is the roll they just made.
	 *
	 * What the steading has built that WAITS on this roll is written here too — Raincatching's summer
	 * Surplus, the stream's in spring. The row used to carry an Apply, which asked the table to
	 * answer a question the dice had just answered in front of them; the roll knows where it landed,
	 * so it pays what landing there owes. Only ever paid, never taken back — see applyOutcome.
	 */
	async recordRoll(moveSlug, outcome) {
		if (!outcome?.key || moveSlug !== this.season.moveSlug) return false;
		await this._actor.update({ "system.seasonRollOutcome": outcome.key });
		await this._effects.applyOutcome(await this.statement(), outcome.key);
		return true;
	}

	get _impressions() { return Impressions.fromRaw(this._actor.system?.impressions); }

	/**
	 * The moments of THIS season that something built actually fires at.
	 *
	 * A moment with nothing behind it is not shown: the autumn harvest is a fact about every autumn,
	 * but a steading with no mill, orchard or greater harvest has nothing for the sheet to offer at
	 * it, and an empty panel headed "The autumn harvest" would read as a thing left undone.
	 */
	async moments() {
		const found = [];
		for (const moment of Moments.inSeason(this.season)) {
			const statement = await this._effects.statementFor("moment", { moment: moment.key });
			if (statement.isEmpty) continue;
			found.push(new MomentSnapshot({ moment, statement }));
		}
		return found;
	}

	/**
	 * Write everything a moment still owes — and only if it can happen in the season the steading is
	 * in.
	 *
	 * The season check is not defensive noise: the per-line records are cleared on the turn, so a
	 * stale click from a client still showing last season would otherwise pay an autumn harvest in
	 * winter.
	 *
	 * Once-per-season needs no guard of its own any more. Each line records that it was applied, and
	 * applying skips what is already recorded, so a second press writes nothing — which is also what
	 * makes this safe on a sheet six people share.
	 */
	async applyMoment(key) {
		const moment = Moments.byKey(key);
		if (!moment?.occursIn(this.season)) return false;
		return this._effects.apply(await this._effects.statementFor("moment", { moment: key }));
	}

	/**
	 * Turn the wheel.
	 *
	 * The year advances when winter gives way to spring (the season knows which one that is, so
	 * nothing here compares keys), the new season is stamped with one of the book's own lines about
	 * it, and last season's record goes: what was applied, and the seasonal gain — because the move
	 * just rolled is what grants the next one. Clearing the record is what makes the mill's harvest
	 * owed again next autumn, and what makes this season's Surplus rolls no longer revertable — they
	 * belong to a season that is over.
	 *
	 * Each record is removed BY NAME. Foundry merges an object-field update rather than replacing it,
	 * so neither assigning `{}` nor assigning null and then `{}` empties one — both leave every key
	 * exactly where it was, silently, and last season's applied lines would still read as applied.
	 * `-=key` is the only thing that removes one, which is verified against 14.365.
	 */
	async turn(random = Math.random) {
		const next = this.season.next;
		await this._actor.update({
			"system.season":           next.key,
			"system.year":             this.year + (this.season.endsYear ? 1 : 0),
			"system.seasonImpression": this._impressions.pickFor(next, random) ?? "",
			...this._forget("turnoverApplied"),
			...this._forget("seasonStepsApplied"),
			// The result the last season was living with. A plain string rather than a keyed store,
			// so it is emptied by assignment where those two are emptied key by key.
			"system.seasonRollOutcome": "",
		});
		// Every list a season can write to, not just the gains: winter picks from its own list, and a
		// loss left standing into spring would be a thing the steading paid for twice.
		for (const group of SeasonalPicks.GROUPS) await this._choices?.controller().clearValues(group);
	}

	/** Every key of one season-scoped store, named for removal. */
	_forget(store) {
		return Object.fromEntries(Object.keys(this._actor.system?.[store] ?? {})
			.map(key => [`system.${store}.-=${key}`, null]));
	}

	/**
	 * Write everything this season still owes.
	 *
	 * Not guarded here any more: each line records itself, and applying skips what is already
	 * recorded, so the second person to press this on a sheet six people share writes nothing rather
	 * than paying the season twice.
	 */
	async applyTurnover() {
		return this._effects.apply(await this._effects.statementFor("turn", { season: this.season }));
	}

	/**
	 * What this season owes, assembled from what the steading has BUILT — a result fires only if its
	 * own requirement holds, so an unbuilt mill contributes nothing.
	 *
	 * Asked for on its own as well as through the snapshot: the season's steps are bent by these same
	 * results, and rolling one needs the statement without the moments and the wheel around it.
	 */
	async statement() { return this._effects.statementFor("turn", { season: this.season }); }

	async buildSnapshot() {
		const season = this.season;
		return new TurnoverSnapshot({
			season:     new SeasonSnapshot(season, true),
			next:       new SeasonSnapshot(season.next, false),
			year:       this.year,
			impression: this.impression,
			wheel:      Seasons.all().map(s => new SeasonSnapshot(s, s.key === season.key)),
			statement:  await this.statement(),
			moments:    await this.moments(),
			size:       this.size,
		});
	}
}
