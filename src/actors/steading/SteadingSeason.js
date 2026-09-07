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
 * Turning the wheel is not an act of its own: it is what rolling the incoming season's Seasons
 * Change move means. So this turns the wheel, and StonetopSteading pairs it with the roll.
 */
export class SteadingSeason {
	constructor(actor, effects, choices) {
		this._actor   = actor;
		this._effects = effects;
		this._choices = choices;
	}

	get season() { return Seasons.byKey(this._actor.system?.season); }
	get year()   { return this._actor.system?.year ?? 1; }

	/** The book's own line for the season this steading is in — stamped when the wheel last turned. */
	get impression() { return this._actor.system?.seasonImpression ?? ""; }

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
	 * Turn the wheel — what rolling the incoming season's Seasons Change move does.
	 *
	 * The year advances when winter gives way to spring (the season knows which one that is, so
	 * nothing here compares keys), the new season is stamped with one of the book's own lines about
	 * it, and last season's record goes: what was applied, and the seasonal gain — because the move
	 * just rolled is what grants the next one. Clearing the record is what makes the mill's harvest
	 * owed again next autumn.
	 *
	 * The object field is nulled before it is emptied: Foundry MERGES an object-field update rather
	 * than replacing it, so assigning an empty object would leave every key in place.
	 */
	async turn(random = Math.random) {
		const next = this.season.next;
		await this._actor.update({
			"system.season":           next.key,
			"system.year":             this.year + (this.season.endsYear ? 1 : 0),
			"system.seasonImpression": this._impressions.pickFor(next, random) ?? "",
			"system.turnoverApplied":  null,
		});
		await this._actor.update({ "system.turnoverApplied": {} });
		// Every list a season can write to, not just the gains: winter picks from its own list, and a
		// loss left standing into spring would be a thing the steading paid for twice.
		for (const group of SeasonalPicks.GROUPS) await this._choices?.controller().clearValues(group);
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

	async buildSnapshot() {
		const season = this.season;
		return new TurnoverSnapshot({
			season:     new SeasonSnapshot(season, true),
			next:       new SeasonSnapshot(season.next, false),
			year:       this.year,
			impression: this.impression,
			wheel:      Seasons.all().map(s => new SeasonSnapshot(s, s.key === season.key)),
			// Assembled from what the steading has BUILT: a result fires here only if its own
			// requirement holds, so an unbuilt mill contributes nothing.
			statement:  await this._effects.statementFor("turn", { season }),
			moments:    await this.moments(),
		});
	}
}
