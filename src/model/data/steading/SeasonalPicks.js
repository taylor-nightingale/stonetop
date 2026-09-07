/**
 * The lists a season's move tells the table to pick from.
 *
 * Two of them: the six seasonal gains that spring, summer and autumn offer, and the four things
 * WINTER takes. The sheet had only ever modelled the gains, and handed a winter steading the gains
 * list — the opposite of what winter's move does.
 *
 * Held as structured data rather than only as prose inside the move descriptions because they are
 * PICKED: they render and persist through the same choice-group machinery as every other choice in
 * the system, so a pick is made and released the same way, and the first-session "Let Spring Break
 * Forth" checklist renders the gains from here too.
 */

export class SeasonalOption {
	constructor(key, name, text) {
		this.key  = key;
		this.name = name;
		this.text = text;
	}
}

/**
 * A named list of options, as choice-group data.
 *
 * Generic, and concrete nowhere: which options a list holds and what it is called is the business of
 * the class that composes it. `SeasonalGains` and `WinterLosses` each hard-code their own, so the
 * generic never has to be handed a blank list to be told what it is.
 */
export class SeasonalPickList {
	constructor(slug, options) {
		this.slug    = slug;
		this.options = options;
	}

	/**
	 * @param count how many the season's move offers. One pick row of `count` — which makes the
	 *              options radios at 1, so choosing again releases the first rather than leaving
	 *              both ticked forever.
	 */
	toChoiceGroupData(count = 1) {
		return {
			slug: this.slug,
			list: [{
				type: "pick",
				pickCount: count,
				options: this.options.map(option => ({
					slug: option.key,
					content: { title: option.name, text: option.text },
				})),
			}],
		};
	}
}

export const SEASONAL_GAINS_GROUP = "seasonal-gains";
export const WINTER_LOSSES_GROUP  = "winter-losses";

// Book I, p.85.
const _GAINS = new SeasonalPickList(SEASONAL_GAINS_GROUP, [
	new SeasonalOption("population", "Population boom",
		"A number of youth come of age, and/or outsiders settle here. Increase Population by 1 (max +3)."),
	new SeasonalOption("tor", "Tor's blessing",
		"Fine weather abounds. Take +1 to Pull Together this season, and any time you roll the Die of Fate for weather, roll twice and take your pick."),
	new SeasonalOption("bounty", "Unexpected bounty",
		"A sudden influx of wild game, trade profits, or some other resource generates 1 Surplus, now."),
	new SeasonalOption("trade", "Trade opportunity",
		"At some point this season, someone offers to trade something valuable at a good price or something unique/unusual at a reasonable price. Pay what they're asking and it's yours."),
	new SeasonalOption("news", "Interesting news",
		"There's an opportunity to improve your fortunes, knowledge, or relations, and/or to make progress towards a steading improvement."),
	new SeasonalOption("insight", "Valuable insight",
		"You learn something that gives you a chance to address a threat that's been plaguing the steading."),
]);

// Seasons Change: Winter's own list — "Then, pick 1" (Book I, p.85). Not gains: every one of these
// costs the steading something, which is why handing winter the gains list read as a reward for the
// hardest season of the year.
const _LOSSES = new SeasonalPickList(WINTER_LOSSES_GROUP, [
	new SeasonalOption("population", "Population lost",
		"Reduce Population by 1 (min -1) due to death, decrepitude, and departure."),
	new SeasonalOption("resource", "A resource lost",
		"An important resource (one of the horses, the cistern, etc.) is lost or not maintained."),
	new SeasonalOption("npc", "An important NPC dies",
		"An important NPC dies, their role unfilled."),
	new SeasonalOption("pc", "A PC leaves",
		"Your PC dies, leaves, or retires from play."),
]);

export class SeasonalGains {
	static all() { return [..._GAINS.options]; }

	static toChoiceGroupData(count = 1) { return _GAINS.toChoiceGroupData(count); }
}

export class WinterLosses {
	static all() { return [..._LOSSES.options]; }

	static toChoiceGroupData(count = 1) { return _LOSSES.toChoiceGroupData(count); }
}

/**
 * Which list a `pick` step names.
 *
 * The one place a list slug becomes a list — a step carries the slug, so nothing between the pack
 * and here has to know that spring picks gains and winter picks losses.
 */
export class SeasonalPicks {
	static GROUPS = [SEASONAL_GAINS_GROUP, WINTER_LOSSES_GROUP];

	static byKey(slug) {
		if (slug === SEASONAL_GAINS_GROUP) return _GAINS;
		if (slug === WINTER_LOSSES_GROUP)  return _LOSSES;
		return null;
	}
}
