// Authored data for the Let Spring Burst Forth walkthrough, kept here (like
// introductions-data.js) so the Chronicle compiler (utils/chronicle-core.js) can
// resolve a ticked seasonal gain's key back to its name without importing the
// Foundry-coupled dialog.

// The six seasonal gains the rolling PC chooses from on a 7+ (Book I, "Seasons
// Change" / Homefront). `text` is the effect shown in the dialog checklist; the
// Chronicle only needs `key` + `name`. The checked keys persist in
// springBurstAnswers.gains ({ <key>: true }).
export const SEASONAL_GAINS = [
	{ key: "population", name: "Population boom",   text: "Youth come of age and/or outsiders settle here. Increase Population by 1 (max +3)." },
	{ key: "tor",        name: "Tor's blessing",    text: "Fine weather abounds. +1 to Pull Together this season, and when you roll the Die of Fate for weather, roll twice and take your pick." },
	{ key: "bounty",     name: "Unexpected bounty", text: "A sudden influx of game, trade profit, or other resource generates 1 Surplus, now." },
	{ key: "trade",      name: "Trade opportunity", text: "Someone offers something valuable at a good price, or something unusual at a reasonable one. Pay what they ask and it's yours." },
	{ key: "news",       name: "Interesting news",  text: "An opportunity to improve your fortunes, knowledge, or relations — or to make progress toward a steading improvement." },
	{ key: "insight",    name: "Valuable insight",  text: "You learn something that gives you a chance to address a threat that's been plaguing the steading." },
];
