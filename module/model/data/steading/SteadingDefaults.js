export const SteadingDefaults = {
	fortunes: {
		title:   "Fortunes",
		note:    "Starts at +1",
		current: 2,
		options: ["-1", "+0", "+1", "+2", "+3"],
	},
	surplus: {
		title:   "Surplus",
		note:    "Starts at 1",
		current: 1,
	},
	attributes: {
		size: {
			title:   "Size",
			note:    "Starts at <em>village</em>",
			options: [
				"<em>hamlet</em> (&lt;50 people)",
				"<em>village</em> (150–350 people)",
				"<em>town</em> (500–1500 people)",
				"<em>city</em> (2500+ people)",
			],
		},
		population: {
			title:   "Population",
			note:    "Starts at +0",
			options: ["-1", "+0", "+1", "+2", "+3"],
		},
		prosperity: {
			title:   "Prosperity",
			note:    "Starts at +0",
			options: ["-1", "+0", "+1", "+2", "+3"],
		},
		defenses: {
			title:   "Defenses",
			note:    "Starts at +0",
			options: [
				"-1 <em>feeble</em>",
				"+0 <em>mediocre</em>",
				"+1 <em>strong</em>",
				"+2 <em>formidable</em>",
				"+3 <em>legendary</em>",
			],
		},
	},
	debilities: [
		{
			slug:        "diminished",
			description: "<em>diminished</em>, by injury/sickness/doubt",
			note:        "disadvantage to Deploy, Muster, or Pull Together",
		},
		{
			slug:        "lacking",
			description: "<em>lacking</em>, due to shortages/hoarding/distrust",
			note:        "treat Prosperity as if it's 1 lower than it is",
		},
		{
			slug:        "malcontent",
			description: "<em>malcontent</em>, from fear/anger/despair",
			note:        "Fortunes reset to +0 each season, not +1; folks need Persuading more often than usual",
		},
	],
	content: {
		description:
			`<p>Keep this in sync with the GM playbook. Review it at the start of each session.</p>` +
			`<p>When <strong><em>anyone calls “time out,”</em></strong> play stops. Step out of character, check in with each other, maybe take a break. Discuss what's wrong, player-to-player.</p>` +
			`<p>If <strong><em>content was included that shouldn’t have been</em></strong>, acknowledge the mistake, fix the fiction, and move on.</p>` +
			`<p>If <strong><em>someone realizes they need content to be excluded, veiled, or handled in a particular way,</em></strong> then update the lists. Clarify specifics, now or later, but don’t ask reasons. Fix the fiction. Check in with the player(s). When everyone is ready, move on.</p>`,
	},
};
