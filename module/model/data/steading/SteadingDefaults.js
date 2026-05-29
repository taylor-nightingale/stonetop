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
			items: [
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
			items: [
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
		"The Stone",
		"The Granary",
		"Public House & Stables",
		"Cistern",
		"Pavilion of the Gods",
		"Watchtowers",
	],
	assets: {
		items: [
			"A pair of hardy draft horses, followers (large, powerful, keen-nosed, hardy): HP 10 each; Damage d6+3 (hand, close, forceful); Instinct: to panic; Cost: care & grooming.",
			"A pair of horse-drawn plows, iron",
			"A pair of carts (plus horse harness)",
			"A wagon (plus horse harness)",
		],
		coinage: [
			{ title: "silver", purses: 0, handfuls: 0, coins: 0 },
			{ title: "gold",   purses: 0, handfuls: 0, coins: 0 },
		],
	},
	residentNames: "Aderyn, Aeronwen, Afanen, Afon, Alun, Andras, Aneirin, Awstin, Bedwyr, Berwyn, Betrys, Braith, Briallen, Bronwen, Bryn, Cadi, Cadoc, Cadwygan, Caron, Cefin, Ceinwen, Ceridwyn, Cerys, Colwyn, Deiniol, Dilwen, Dylis, Eifion, Eirlys, Eluned, Emrys, Enfys, Eurwen, Gaenor, Garet, Gethin, Glyndir, Heledd, Hywel, Ifan, Iorwerth, Iwan, Lewela, Leuca, Linos, Mado, Maldwyn, Malon, Mared, Marged, Martyn, Meirion, Menwen, Mererid, Neirin, Nia, Ofydd, Olwyn, Owain, Padrig, Parry, Pryce, Pryder, Rheinal, Rhisiart, Rhosyn, Rydderch, Sawyl, Siana, Sioned, Talfryn, Tegid, Tiwlip, Tomos, Tudyr, Winifred, Yorath",
	residentTraits: [
		"all thumbs", "dallied with the Fae years ago", "has a beef with Marshedge", "immaculate appearance", "mute",
		"ambitious", "deaf", "has a good heart", "jealous", "not afraid of deep water",
		"beloved by everyone", "desperately wants a child", "has a lot of backbone", "just got married", "not too bright",
		"beautiful singing voice", "distills the best whisky", "has a wandering eye", "keeps to themselves", "oldest",
		"best cook", "doesn't pull their weight", "has a way with animals", "knows all the gossip", "orphan",
		"best weaver", "drunkard", "has Fae blood in their veins", "lame", "overprotective",
		"blind", "eagle-eye", "has just terrible luck", "likes to hurt things", "prettiest",
		"braved the Ruined Tower", "fearless", "has lost their nerve", "lived among the Forest Folk", "prideful",
		"cautious", "foundling", "has no respect for their elders", "lost all their children", "reckless",
		"cheery", "gathers herbs from the Wood", "has terrible nightmares", "lovesick", "refuses to marry",
		"chronic cough", "gets the best deals", "has the most children", "loves their dogs", "resents their lot in life",
		"complains too much", "gifted storyteller", "has their head in the clouds", "loyal friend", "runs everywhere",
		"cowardly", "gods-fearing", "hates the Hillfolk", "most handsome", "sensitive",
		"craves recognition", "good with children", "hears voices", "moved here recently", "simpleton",
		"curious", "happy-go-lucky", "humorless", "must approve any marriages", "slew many crinwin",
		"stoic", "stubborn", "suffers from fits", "swears they met the Pale Hunter", "tells the best jokes",
		"tender-hearted", "tends the Gods' Pavilion", "tends to the sick & injured", "touched", "very strong",
		"wants to have kids", "well-read", "well-traveled", "widowed", "will eat anything",
	],
	neighborPlaces: [
		{name: "Marshedge",    subtitle: "",                                   note: "", names: "Abben, Ailen, Brin, Brogan, Catlin, Coln, Daedre, Dermos, Ennin, Finnen, Gilor, Isbeal, Kiran, Lile, Lim, Mathuin, Mirne, Noren, Owan, Ragan, Renan, Seadha, Seann, Tierney, Ulliam"},
		{name: "Gordin's Delve", subtitle: "",                                 note: "", names: "Choose from other lists; everyone comes to Gordin's Delve from somewhere else."},
		{name: "The Steplands", subtitle: "Hillfolk",                          note: "", names: "Adm, Blej, Cirl, Davth, Elst, Gwilm, Gwenl, Henri, Ines, Jenfir, Jown, Juda, Kiln, Laurl, Loic, Merrn, Maikl, Nanzl, Nolwn, Quent, Reegn, Ropr, Sabi, Stren, Yanz"},
		{name: "Lygos",         subtitle: "and other points south",            note: "", names: "Agatte, Aref, Alix, Baraz, Canan, Darya, Demetra, Elene, Elios, Fotios, Faruza, Golza, Iasos, Iona, Kyriakos, Marika, Maayan, Osher, Natasa, Nivola, Rinat, Stamat, Thecla, Zhaleh"},
		{name: "Other places",  subtitle: "Barrier Pass, the Manmarch, etc.", note: "", names: ""},
	],
	content: {
		description:
			"<p>Keep this in sync with the GM playbook. Review it at the start of each session.</p>" +
			"<p>When <strong><em>anyone calls “time out,”</em></strong> play stops. Step out of character, check in with each other, maybe take a break. Discuss what’s wrong, player-to-player.</p>" +
			"<p>If <strong><em>content was included that shouldn’t have been</em></strong>, acknowledge the mistake, fix the fiction, and move on.</p>" +
			"<p>If <strong><em>someone realizes they need content to be excluded, veiled, or handled in a particular way,</em></strong> then update the lists. Clarify specifics, now or later, but don’t ask reasons. Fix the fiction. Check in with the player(s). When everyone is ready, move on.</p>",
	},
};
