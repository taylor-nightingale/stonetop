// Shared suggestion lists for steading residents / neighbors / players.
//
// These power the free-type combo fields in two places: the "Add Steading
// Member" dialog (AddSteadingMemberDialog) and the inline Residents / Neighbors /
// Players tables on the steading sheet (steading-tab-neighbors.hbs). Keep them
// here so both surfaces draw from one source — the rules let you go off-script,
// so these are suggestions in a <datalist>, never a closed list.

export const OCCUPATIONS = [
	"Baker", "Beekeeper", "Blacksmith", "Bonesetter", "Brewer", "Butcher",
	"Carpenter", "Chandler", "Charcoal burner", "Cobbler", "Cook", "Cooper",
	"Ditchdigger", "Dyer",
	"Falconer", "Farmer", "Fisherman", "Fletcher", "Forester", "Fuller",
	"Glassblower", "Grave digger", "Guard",
	"Harness maker", "Healer", "Herbalist", "Homemaker", "Hunter",
	"Innkeep",
	"Laundress", "Leatherworker",
	"Mason", "Merchant", "Midwife", "Miller",
	"Ostler",
	"Peddler", "Porter", "Potter", "Priest", "Publican",
	"Ropemaker",
	"Saddler", "Scribe", "Shepherd", "Shrine keeper", "Smith", "Spinner", "Stable hand", "Stonecutter",
	"Tanner", "Thatcher", "Tinker", "Trapper",
	"Watchman", "Weaver", "Wheelwright", "Woodcarver", "Woodcutter",
];

export const TRAITS = [
	"all thumbs", "ambitious", "beautiful singing voice", "beloved by everyone",
	"best cook", "best weaver", "blind", "braved the Ruined Tower",
	"cautious", "cheery", "chronic cough", "complains too much", "cowardly",
	"craves recognition", "curious", "dallied with the Fae years ago", "deaf",
	"desperately wants a child", "distills the best whisky", "doesn't pull their weight",
	"drunkard", "eagle-eye", "fearless", "foundling", "gathers herbs from the Wood",
	"gets the best deals", "gifted storyteller", "gods-fearing", "good with children",
	"happy-go-lucky", "has a beef with Marshedge", "has a good heart",
	"has a lot of backbone", "has a wandering eye", "has a way with animals",
	"has Fae blood in their veins", "has just terrible luck", "has lost their nerve",
	"has no respect for their elders", "has terrible nightmares", "has the most children",
	"has their head in the clouds", "hates the Hillfolk", "hears voices", "humorless",
	"immaculate appearance", "jealous", "just got married", "keeps to themselves",
	"knows all the gossip", "lame", "likes to hurt things", "lived among the Forest Folk",
	"lost all their children", "lovesick", "loves their dogs", "loyal friend",
	"most handsome", "moved here recently", "must approve any marriages", "mute",
	"not afraid of deep water", "not too bright", "oldest orphan", "overprotective",
	"prettiest", "prideful", "reckless", "refuses to marry", "resents their lot in life",
	"runs everywhere", "sensitive", "simpleton", "slew many crinwin", "stoic",
	"stubborn", "suffers from fits", "swears they met the Pale Hunter",
	"tells the best jokes", "tender-hearted", "tends the Gods' Pavilion",
	"tends to the sick & injured", "touched", "very strong", "wants to have kids",
	"well-read", "well-traveled", "widowed", "will eat anything",
];

export const HOMES = [
	"Marshedge", "Gordin's Delve", "The Steplands",
	"Lygos", "Barrier Pass", "The Manmarch",
];

// Suggestion lists for naming an anonymous Marshal-crew member (the "Name them"
// flow on the character sheet's Followers tab). Used as <datalist> fallbacks when
// the playbook pack doesn't carry its own `crew.individualOptions` — kept here so
// the data lives outside the sheet's render code.
export const CREW_INDIVIDUAL_NAMES = ["Aled","Culhwch","Eira","Gerat","Glaw","Harri","Lowri","Mervyn","Nesta"];
export const CREW_INDIVIDUAL_TAGS = ["animal-lover","big","bully","cynical","drunkard","eager","gambler","greedy","grumpy","gullible","hearthrob","honest","kind","little","naive","old","popular","proud","reckless","rookie","shameless","sharp-eyed","short-tempered"];
export const CREW_INDIVIDUAL_TRAITS = ["__'s kid/sibling/parent/cousin/__","bald","crush on __","grudge against __","hates __","idolizes __","jokes a lot","messy","missing eye/finger/hand/__","misses their kids","nightmares","recently married","religious","scars","skinny","sharp-tongued","sings","snores","tells tall tales","too serious","whistler","whittler"];
