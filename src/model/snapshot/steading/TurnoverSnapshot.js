import { rich } from "../RichText.js";

/**
 * The Season tab's turnover: where the wheel stands, and everything Stonetop has built that fires
 * here. Assembled from the improvements the steading OWNS, so it says nothing about a mill the
 * steading has not built.
 */
export class TurnoverSnapshot {
	constructor({ season, next, year, wheel, impression = "", statement = null, moments = [], size = null }) {
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
		// The named points WITHIN this season at which something built fires — the autumn harvest, the
		// aurochs hunt. Separate from the statement above because they are separate acts: the wheel
		// turning is not the harvest coming in, and a mill paid out the moment autumn arrived would be
		// paid a month early. Only moments something actually fires at are here.
		this.moments   = moments;
		// How big the steading is. Here because a season's own dice depend on it — winter consumes
		// 1d2+Population in a hamlet and 2d6+Population in a town — and the steps are built from this
		// snapshot rather than from the actor.
		this.size      = size;
	}

	get hasClauses() { return Boolean(this.statement && !this.statement.isEmpty); }

	/**
	 * Whether the general list has anything of its OWN to show.
	 *
	 * Most of what a season brings is now shown where it happens — in the step it bends, the result
	 * row it waits on, the step that generates it, the bills the steading keeps up — and a heading
	 * with nothing under it reads as a section that failed to load. What is left here is what belongs
	 * nowhere else: a clause the sheet can only state, and a move the season hands the table.
	 */
	get hasOwnClauses() {
		return Boolean(this.statement?.owed.length || this.statement?.advisoryOwed.length
			|| this.statement?.grantedMoveSlugs.length);
	}

	/**
	 * Everything this season owed has been written.
	 *
	 * Asked of the statement rather than stored, now that each line records itself: a separate "the
	 * turn was applied" flag could disagree with the lines it claims to summarise, and on a sheet six
	 * people share the one that is wrong is the one that gets believed.
	 */
	get applied() { return Boolean(this.statement?.isFullyApplied); }

	get hasMoments() { return this.moments.length > 0; }
}

/**
 * One moment of the season, with what fires at it.
 *
 * The sheet cannot know when the harvest came in or when the hunt was led — no amount of watching the
 * calendar tells it. The table says so, by applying the moment. So this is an offer, not a schedule.
 */
export class MomentSnapshot {
	constructor({ moment, statement }) {
		this.key       = moment.key;
		this.labelKey  = moment.labelKey;
		this.statement = statement;
	}

	/**
	 * Written, and not owed again until the wheel comes round — the per-line records live in the
	 * season-scoped store, which is cleared on the turn.
	 */
	get applied() { return Boolean(this.statement?.isFullyApplied); }

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
