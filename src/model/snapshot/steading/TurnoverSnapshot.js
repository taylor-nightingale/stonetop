import { rich } from "../RichText.js";

/**
 * The Season tab's turnover: where the wheel stands, and everything Stonetop has built that fires
 * here. Assembled from the improvements the steading OWNS, so it says nothing about a mill the
 * steading has not built.
 */
export class TurnoverSnapshot {
	constructor({ season, next, year, wheel, impression = "", statement = null, applied = false,
	              moments = [] }) {
		this.season  = season;          // SeasonSnapshot — the current one
		// The season the wheel turns to. Carried because turning it is not an abstract act: you roll
		// that season's own Seasons Change move, and the tab has to put the two together.
		this.next    = next;
		this.year    = year;
		// The book's own sensory line for this season, stamped when the wheel turned. Empty for a
		// steading whose steadfast prints no Impressions section — the tab then simply says less.
		this.impression = impression;
		this.wheel   = wheel;           // SeasonSnapshot[] — all four, in the book's order
		// What everything Stonetop has built does this season, as one reviewable statement.
		this.statement = statement;
		// Whether it has already been written. The guard exists because six people share this sheet
		// and the second person to press Apply must not pay the season twice.
		this.applied   = applied;
		// The named points WITHIN this season at which something built fires — the autumn harvest, the
		// aurochs hunt. Separate from the statement above because they are separate acts: the wheel
		// turning is not the harvest coming in, and a mill paid out the moment autumn arrived would be
		// paid a month early. Only moments something actually fires at are here.
		this.moments   = moments;
	}

	get hasClauses() { return Boolean(this.statement && !this.statement.isEmpty); }

	get hasMoments() { return this.moments.length > 0; }
}

/**
 * One moment of the season, with what fires at it.
 *
 * The sheet cannot know when the harvest came in or when the hunt was led — no amount of watching the
 * calendar tells it. The table says so, by applying the moment. So this is an offer, not a schedule.
 */
export class MomentSnapshot {
	constructor({ moment, statement, applied = false }) {
		this.key       = moment.key;
		this.labelKey  = moment.labelKey;
		this.statement = statement;
		// Applied once per season, and cleared when the wheel turns — an autumn harvest is owed again
		// next autumn.
		this.applied   = applied;
	}

	/** The move this moment hands the table to roll, if any — the hunt is led by rolling it. */
	get moveSlug() {
		return this.statement.lines.find(l => l.grantsMove)?.grantsMove ?? null;
	}
}

/** One season as the wheel draws it: its key, its translated name, and whether it is the current one. */
export class SeasonSnapshot {
	constructor(season, current) {
		this.key      = season.key;
		this.labelKey = season.labelKey;
		this.moveSlug = season.moveSlug;
		this.isCurrent = current;
	}
}
