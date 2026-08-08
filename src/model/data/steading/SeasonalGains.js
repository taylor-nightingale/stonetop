// The six seasonal gains a steading picks from when Seasons Change tells it to (Book I, p.85).
// Held here as structured data — not just prose inside the move descriptions — because the
// first-session "Let Spring Break Forth" section renders them as a choice group the table picks from.

export class SeasonalGain {
	constructor(key, name, text) {
		this.key  = key;
		this.name = name;
		this.text = text;
	}
}

const _GAINS = [
	new SeasonalGain("population", "Population boom",
		"A number of youth come of age, and/or outsiders settle here. Increase Population by 1 (max +3)."),
	new SeasonalGain("tor", "Tor's blessing",
		"Fine weather abounds. Take +1 to Pull Together this season, and any time you roll the Die of Fate for weather, roll twice and take your pick."),
	new SeasonalGain("bounty", "Unexpected bounty",
		"A sudden influx of wild game, trade profits, or some other resource generates 1 Surplus, now."),
	new SeasonalGain("trade", "Trade opportunity",
		"At some point this season, someone offers to trade something valuable at a good price or something unique/unusual at a reasonable price. Pay what they're asking and it's yours."),
	new SeasonalGain("news", "Interesting news",
		"There's an opportunity to improve your fortunes, knowledge, or relations, and/or to make progress towards a steading improvement."),
	new SeasonalGain("insight", "Valuable insight",
		"You learn something that gives you a chance to address a threat that's been plaguing the steading."),
];

export const SEASONAL_GAINS_GROUP = "seasonal-gains";

export class SeasonalGains {
	static all() {
		return [..._GAINS];
	}

	// The gains as choice-group data, so they render and persist through the same pick machinery as
	// every other choice in the system rather than a bespoke checkbox of their own. One pick row of
	// one — "pick 1 seasonal gain" — which makes the options radios, so choosing a second gain
	// releases the first instead of leaving both ticked forever.
	static toChoiceGroupData() {
		return {
			slug: SEASONAL_GAINS_GROUP,
			list: [{
				type: "pick",
				pickCount: 1,
				options: _GAINS.map(gain => ({
					slug: gain.key,
					content: { title: gain.name, text: gain.text },
				})),
			}],
		};
	}
}
