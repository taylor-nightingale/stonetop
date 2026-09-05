import { Seasons } from "../../model/data/steading/Seasons.js";
import { Impressions } from "../../model/data/steading/Impressions.js";
import { Moments } from "../../model/data/steading/Moments.js";
import { SEASONAL_GAINS_GROUP } from "../../model/data/steading/SeasonalGains.js";
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

	/** Whether this season's turnover has already been written. */
	isApplied(key = "turn") {
		return Boolean((this._actor.system?.turnoverApplied ?? {})[key]);
	}

	static _momentKey(key) { return `moment:${key}`; }

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
			found.push(new MomentSnapshot({
				moment, statement, applied: this.isApplied(SteadingSeason._momentKey(moment.key)),
			}));
		}
		return found;
	}

	/**
	 * Write what a moment does — once, and only if it can happen in the season the steading is in.
	 *
	 * The season check is not defensive noise: `turnoverApplied` is cleared on the turn, so a stale
	 * click from a client still showing last season would otherwise pay an autumn harvest in winter.
	 */
	async applyMoment(key) {
		const moment = Moments.byKey(key);
		if (!moment?.occursIn(this.season)) return false;
		const applyKey = SteadingSeason._momentKey(key);
		if (this.isApplied(applyKey)) return false;
		const statement = await this._effects.statementFor("moment", { moment: key });
		await this._effects.apply(statement);
		await this._actor.update({ [`system.turnoverApplied.${applyKey}`]: true });
		return true;
	}

	/**
	 * Turn the wheel — what rolling the incoming season's Seasons Change move does.
	 *
	 * The year advances when winter gives way to spring (the season knows which one that is, so
	 * nothing here compares keys), the new season is stamped with one of the book's own lines about
	 * it, and last season's record goes: what was applied, which lines the table dropped, and the
	 * seasonal gain — because the move just rolled is what grants the next one.
	 *
	 * The object fields are nulled before they are emptied: Foundry MERGES an object-field update
	 * rather than replacing it, so assigning an empty object would leave every key in place.
	 */
	async turn(random = Math.random) {
		const next = this.season.next;
		await this._actor.update({
			"system.season":           next.key,
			"system.year":             this.year + (this.season.endsYear ? 1 : 0),
			"system.seasonImpression": this._impressions.pickFor(next, random) ?? "",
			"system.turnoverApplied":  null,
			"system.turnoverExcluded": null,
		});
		await this._actor.update({ "system.turnoverApplied": {}, "system.turnoverExcluded": {} });
		await this._choices?.controller().clearValues(SEASONAL_GAINS_GROUP);
	}

	/**
	 * Write what this season does to the steading — once.
	 *
	 * Guarded, because six people share this sheet: the second person to press Apply must not pay the
	 * season twice.
	 */
	async applyTurnover() {
		if (this.isApplied("turn")) return false;
		const statement = await this._effects.statementFor("turn", { season: this.season });
		await this._effects.apply(statement);
		await this._actor.update({ "system.turnoverApplied.turn": true });
		return true;
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
			applied:    this.isApplied("turn"),
			moments:    await this.moments(),
		});
	}
}
