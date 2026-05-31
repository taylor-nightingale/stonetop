function applyUpdate(obj, data) {
	for (const [key, value] of Object.entries(data)) {
		const parts = key.split(".");
		let target = obj;
		for (let i = 0; i < parts.length - 1; i++) {
			if (typeof target[parts[i]] !== "object" || target[parts[i]] === null) {
				target[parts[i]] = {};
			}
			target = target[parts[i]];
		}
		target[parts[parts.length - 1]] = value;
	}
}

export class FakeSteadingBuilder {
	build() {
		const actor = {
			name: "Stonetop",
			type: "steading",
			system: {
				fortunes: 2,
				surplus:  1,
				notes:    "",
				debilities: { diminished: false, lacking: false, malcontent: false },
				attributes: {
					size:       { current: 1, items: [] },
					population: { current: 1, items: [] },
					prosperity: { current: 1, items: [
						"Farming (beans, potatoes, oats, barley)",
						"Hunting/trapping (fur, meat, hides)",
						"Distilling (whisky)",
						"Stone (collected from the Old Wall)",
						"Cistern (filled with rain, snow)",
						"Tradesfolk (midwife, potter, publican, smith, tanner)",
						"Trade: Gordin's Delve (metal, tools)",
						"Trade: Marshedge (textiles, herbs, glass)",
					]},
					defenses: { current: 1, items: [
						"Village militia",
						"The Ringwall (low, stone)",
						"3 watchtowers",
						"Some bows",
					]},
				},
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
				content: { excluded: [], veiled: [], specialHandling: [] },
				placesOfInterest: [
					"The Stone",
					"The Granary",
					"Public House & Stables",
					"Cistern",
					"Pavilion of the Gods",
					"Watchtowers",
				],
				neighborPlaces: [
					{ slug: "marshedge",    name: "Marshedge",       subtitle: "",                                  note: "", names: "Abben, Ailen, Brin, Brogan, Catlin, Coln, Daedre, Dermos, Ennin, Finnen, Gilor, Isbeal, Kiran, Lile, Lim, Mathuin, Mirne, Noren, Owan, Ragan, Renan, Seadha, Seann, Tierney, Ulliam" },
					{ slug: "gordins-delve",name: "Gordin's Delve",  subtitle: "",                                  note: "", names: "Choose from other lists; everyone comes to Gordin's Delve from somewhere else." },
					{ slug: "steplands",    name: "The Steplands",   subtitle: "Hillfolk",                          note: "", names: "Adm, Blej, Cirl, Davth, Elst, Gwilm, Gwenl, Henri, Ines, Jenfir, Jown, Juda, Kiln, Laurl, Loic, Merrn, Maikl, Nanzl, Nolwn, Quent, Reegn, Ropr, Sabi, Stren, Yanz" },
					{ slug: "lygos",        name: "Lygos",            subtitle: "and other points south",           note: "", names: "Agatte, Aref, Alix, Baraz, Canan, Darya, Demetra, Elene, Elios, Fotios, Faruza, Golza, Iasos, Iona, Kyriakos, Marika, Maayan, Osher, Natasa, Nivola, Rinat, Stamat, Thecla, Zhaleh" },
					{ slug: "other",        name: "Other places",     subtitle: "Barrier Pass, the Manmarch, etc.", note: "", names: "" },
				],
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
			},
			flags: {},
			getFlag:                () => undefined,
			setFlag:                () => Promise.resolve(),
			createEmbeddedDocuments: vi.fn(),
			deleteEmbeddedDocuments: vi.fn(),
			update: (data) => { applyUpdate(actor, data); return Promise.resolve(); },
		};
		return actor;
	}
}
