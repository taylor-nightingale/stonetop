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
			current: 1,
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
			current: 1,
			options: ["-1", "+0", "+1", "+2", "+3"],
		},
		prosperity: {
			title:   "Prosperity",
			note:    "Starts at +0",
			current: 1,
			options: ["-1", "+0", "+1", "+2", "+3"],
			resources: [
				"Farming (beans, potatoes, oats, barley)",
				"Hunting/trapping (fur, meat, hides)",
				"Distilling (whisky)",
				"Stone (collected from the Old Wall)",
				"Cistern (filled with rain, snow)",
				"Tradesfolk (midwife, potter, publican, smith, tanner)",
				"Trade: Gordin's Delve (metal, tools)",
				"Trade: Marshedge (textiles, herbs, glass)",
			],
		},
		defenses: {
			title:   "Defenses",
			note:    "Starts at +0",
			current: 1,
			options: [
				"-1 <em>feeble</em>",
				"+0 <em>mediocre</em>",
				"+1 <em>strong</em>",
				"+2 <em>formidable</em>",
				"+3 <em>legendary</em>",
			],
			resources: [
				"Village militia",
				"The Ringwall (low, stone)",
				"3 watchtowers",
				"Some bows",
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
	placesOfInterest: [
		{ key: "A", title: "The Stone" },
		{ key: "B", title: "The Granary" },
		{ key: "C", title: "Public House & Stables" },
		{ key: "D", title: "Cistern" },
		{ key: "E", title: "Pavilion of the Gods" },
		{ key: "F", title: "Watchtowers" },
	],
	assets: {
		coinage: [{ title: "silver", purses: 0, handfuls: 0, coins: 0 }],
	},
};
