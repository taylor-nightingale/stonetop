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

// A fully-applied Stonetop steading in the NEW shape: ratings are actual game numbers, `size` is a
// tier string, the Prosperity/Defenses source lists live under assets.resources/fortifications, the
// resident name/trait pool is `residents` (the people are `residentPeople`), and improvements are an
// owned slug list. Mirrors what applySteadfast(stonetop) produces.
export class FakeSteadingBuilder {
	_steadfast = "stonetop";

	// "" models a brand-new steading (no steadfast applied yet — the create-hook case).
	withSteadfast(slug) {
		this._steadfast = slug;
		return this;
	}

	build() {
		const actor = {
			name: "Stonetop",
			type: "steading",
			system: {
				steadfast: this._steadfast,
				description: "",
				notes:    "",
				rollMode: "normal",
				debilities: { diminished: false, lacking: false, malcontent: false },
				content: { excluded: [], veiled: [], specialHandling: [], excludedText: "", veiledText: "", specialHandlingText: "" },
				attributes: { fortunes: 1, surplus: 1, size: "village", population: 0, prosperity: 0, defenses: 0 },
				startingAttributes: { fortunes: 1, surplus: 1, size: "village", population: 0, prosperity: 0, defenses: 0 },
				assets: {
					items: [
						"A pair of hardy draft horses, followers (large, powerful, keen-nosed, hardy): HP 10 each; Damage d6+3 (hand, close, forceful); Instinct: to panic; Cost: care & grooming.",
						"A pair of horse-drawn plows, iron",
						"A pair of carts (plus horse harness)",
						"A wagon (plus horse harness)",
					],
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
					fortifications: [
						"Village militia",
						"The Ringwall (low, stone)",
						"3 watchtowers",
						"Some bows",
					],
					coinage: [
						{ title: "silver", purses: 0, handfuls: 0, coins: 0 },
						{ title: "gold",   purses: 0, handfuls: 0, coins: 0 },
					],
				},
				placesOfInterest: [
					{ name: "The Stone",              journalReference: "" },
					{ name: "The Granary",            journalReference: "" },
					{ name: "Public House & Stables", journalReference: "" },
					{ name: "Cistern",                journalReference: "" },
					{ name: "Pavilion of the Gods",   journalReference: "" },
					{ name: "Watchtowers",            journalReference: "" },
				],
				neighborPlaces: [
					{ slug: "marshedge",    name: "Marshedge",       subtitle: "",                                  note: "", names: "Abben, Ailen, Brin, Brogan, Catlin, Coln, Daedre, Dermos, Ennin, Finnen, Gilor, Isbeal, Kiran, Lile, Lim, Mathuin, Mirne, Noren, Owan, Ragan, Renan, Seadha, Seann, Tierney, Ulliam" },
					{ slug: "gordins-delve",name: "Gordin's Delve",  subtitle: "",                                  note: "", names: "Choose from other lists; everyone comes to Gordin's Delve from somewhere else." },
					{ slug: "steplands",    name: "The Steplands",   subtitle: "Hillfolk",                          note: "", names: "Adm, Blej, Cirl, Davth, Elst, Gwilm, Gwenl, Henri, Ines, Jenfir, Jown, Juda, Kiln, Laurl, Loic, Merrn, Maikl, Nanzl, Nolwn, Quent, Reegn, Ropr, Sabi, Stren, Yanz" },
					{ slug: "lygos",        name: "Lygos",            subtitle: "and other points south",           note: "", names: "Agatte, Aref, Alix, Baraz, Canan, Darya, Demetra, Elene, Elios, Fotios, Faruza, Golza, Iasos, Iona, Kyriakos, Marika, Maayan, Osher, Natasa, Nivola, Rinat, Stamat, Thecla, Zhaleh" },
					{ slug: "other",        name: "Other places",     subtitle: "Barrier Pass, the Manmarch, etc.", note: "", names: "" },
				],
				residents: {
					names: "Aderyn, Aeronwen, Afanen, Afon, Alun, Andras, Aneirin, Awstin, Bedwyr, Berwyn, Betrys, Braith, Briallen, Bronwen, Bryn, Cadi, Cadoc, Cadwygan, Caron, Cefin, Ceinwen, Ceridwyn, Cerys, Colwyn, Deiniol, Dilwen, Dylis, Eifion, Eirlys, Eluned, Emrys, Enfys, Eurwen, Gaenor, Garet, Gethin, Glyndir, Heledd, Hywel, Ifan, Iorwerth, Iwan, Lewela, Leuca, Linos, Mado, Maldwyn, Malon, Mared, Marged, Martyn, Meirion, Menwen, Mererid, Neirin, Nia, Ofydd, Olwyn, Owain, Padrig, Parry, Pryce, Pryder, Rheinal, Rhisiart, Rhosyn, Rydderch, Sawyl, Siana, Sioned, Talfryn, Tegid, Tiwlip, Tomos, Tudyr, Winifred, Yorath",
					traits: [
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
				residentPeople: [],
				neighborPeople: [],
				improvements: [
					"additional-housing", "aurochs-hunting", "expanded-trades", "greater-harvest",
					"harnessing-the-stream", "herd-of-horses", "heroic-reputation", "inn", "market",
					"mill", "palisade", "raincatching", "standing-watch", "stone-wall", "township",
					"weapons-of-war", "well-trained-militia",
				],
				improvementValues: {},
				resources: { counts: {}, texts: {} },
			},
			flags: {},
			getFlag:                () => undefined,
			setFlag:                () => Promise.resolve(),
			update: (data) => { applyUpdate(actor, data); return Promise.resolve(); },
		};

		// A working embedded-item collection so seeded homefront moves (and their toggling) behave like
		// the real actor — buildSnapshot seeds items and reads them back through the standard flow.
		const items = [];
		items.get = id => items.find(i => i._id === id) ?? null;
		let nextId = 0;
		actor.items = items;
		actor.createEmbeddedDocuments = async (_, docs) => {
			const results = docs.map(d => ({ ...d, _id: `created-${nextId++}` }));
			items.push(...results);
			items.get = id => items.find(i => i._id === id) ?? null;
			return results;
		};
		actor.updateEmbeddedDocuments = async (_, updates) => {
			for (const update of updates) {
				const item = items.get(update._id);
				if (!item) continue;
				if (update.name !== undefined) item.name = update.name;
				if (update.system) for (const [key, value] of Object.entries(update.system)) item.system[key] = value;
			}
			return updates;
		};
		actor.deleteEmbeddedDocuments = async (_, ids) => {
			const idSet = new Set(ids);
			for (let i = items.length - 1; i >= 0; i--) if (idSet.has(items[i]._id)) items.splice(i, 1);
			return ids;
		};
		return actor;
	}
}
