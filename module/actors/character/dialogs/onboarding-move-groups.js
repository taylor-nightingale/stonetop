// Per-playbook groupings for the onboarding "Starting Moves" filter chips. Each
// playbook gets three chips, each a single word that defines a cluster of that
// playbook's moves (derived from a survey of every playbook's move list). A move
// may belong to more than one group. Moves left out — chiefly the generic
// advancement moves (Improved Stat, Superior Stat) and a few outliers — match no
// chip and are reachable only via the text search.
//
// Names must match the move item names exactly (raw doc.name, before display
// normalization). Keyed by playbook display name (Item.system.playbook).

export const ONBOARDING_MOVE_GROUPS = {
	"The Blessed": [
		{ key: "spirits", label: "Spirits", moves: ["Big Magic", "Borrow Power", "Call the Spirits", "Danu's Grasp", "Rites of the Land", "Shared Souls", "Spirit Tongue", "Voice of the Earth Mother"] },
		{ key: "nature", label: "Nature", moves: ["Barkskin", "Into the Lion's Den", "Lightning Rod", "Nature's Wrath", "Trackless Step", "Wild Soul"] },
		{ key: "wards", label: "Wards", moves: ["Amulets & Talismans", "Healer's Arts", "Potent Workings", "Suck the Poison Out", "Veil", "Wards & Bindings"] },
	],
	"The Fox": [
		{ key: "stealth", label: "Stealth", moves: ["Burgle", "Catlike", "Eye on the Door", "Free Running", "Light Fingers", "Slippery", "Danger Sense", "Perceptive"] },
		{ key: "combat", label: "Combat", moves: ["All in the Wrist", "Ambush", "Battle Dancer", "Cheap Shot", "Parry & Riposte", "Second Intent", "Skill at Arms"] },
		{ key: "charm", label: "Charm", moves: ["Irresistible", "Pants on Fire", "Rapier Wit", "Silver Tongued", "Under Your Skin"] },
	],
	"The Heavy": [
		{ key: "offense", label: "Offense", moves: ["Battle Joy", "Berserker", "Bringer of Ruin", "Dangerous", "Mighty Thews", "Musclebound", "Nemesis", "Payback", "Relentless", "Terror on the Field", "Intimidating", "Formidable"] },
		{ key: "defense", label: "Defense", moves: ["Armored", "Guardian", "Steadfast Guardian", "Uncanny Reflexes"] },
		{ key: "grit", label: "Grit", moves: ["Hard to Kill", "Unstoppable", "Unfettered", "Frosty", "Stone Cold", "Seasoned Warrior", "Carved Out of Wood", "Cut from Granite"] },
	],
	"The Judge": [
		{ key: "justice", label: "Justice", moves: ["Censure", "Condemn", "Proclamation", "Castigate", "Armistice", "Binding Arbitration", "Bear Witness", "Truth or Consequences", "For the Greater Good"] },
		{ key: "defense", label: "Defense", moves: ["Armored", "A Mighty Rampart", "Aegis of Faith", "Bulwark", "Mirrorshield", "The Tower Eternal", "A Bundle of Sticks Unbroken"] },
		{ key: "lore", label: "Lore", moves: ["Knowledge is Power", "Well-Read", "Chronicler of Stonetop", "Vision Unclouded", "Hound of Aratis"] },
	],
	"The Lightbearer": [
		{ key: "faith", label: "Faith", moves: ["Invoke the Sun God", "Empowered Invocations", "Burn Twice as Bright", "Glorious Servant", "Piety", "Wielder of the White Flame"] },
		{ key: "flame", label: "Flame", moves: ["Consecrated Flame", "Lamplighter", "Light, More Light", "Hungry Flames", "Purifying Flames", "A Candle Against the Dark", "Luminous Shield", "Fire Within", "Keep the Home-Fires Burning"] },
		{ key: "insight", label: "Insight", moves: ["All is Illuminated", "And Behold a Pale Horse", "Helior's Unblinking Eye", "Guiding Light", "Radiant Countenance", "Rise Like the Sun", "Spring's First Thaw"] },
	],
	"The Marshal": [
		{ key: "command", label: "Command", moves: ["Crew", "Veteran Crew", "Front Line Leader", "Heroes to the Last", "Sir, Permission to Die, Sir", "Shake It Off", "We Happy Few", "Stentorian", "Noble Mien"] },
		{ key: "combat", label: "Combat", moves: ["Armored", "Battlefield Grace", "Focus Fire", "Set-Up Strike", "Shield Wall", "Peace Through Strength", "Prepare a Welcome", "Speak Softly", "Arts of War"] },
		{ key: "tactics", label: "Tactics", moves: ["Logistics", "Read the Land", "Take the Measure", "Like an Open Book"] },
	],
	"The Ranger": [
		{ key: "wilds", label: "Wilds", moves: ["A Safe Place", "Home on the Range", "Mental Map", "On the Hoof", "Pathfinder", "Survivalist", "Trailblazer", "Stalker", "Naturalist", "Expert Tracker", "Worldly", "Walk It Off", "Warden of the Wild", "Sniff Out Corruption"] },
		{ key: "combat", label: "Combat", moves: ["Big Game Hunter", "Blot Out the Sun", "Call the Shot", "Giant Slayer", "Predator", "Constant Vigilance"] },
		{ key: "beast", label: "Beast", moves: ["Alpha", "Animal Companion", "Beast of Legend", "Magnificent Specimen", "Pack Horse", "Wild Speech"] },
	],
	"The Seeker": [
		{ key: "arcana", label: "Arcana", moves: ["Arcane Adept", "Conduit of Power", "Improvise", "Initiate of the Secret Arts", "Mind Over Magic", "Overchannel", "Everything Bleeds", "Everything Burns", "Work With What You've Got", "Safety First", "Proof Against Detection"] },
		{ key: "lore", label: "Lore", moves: ["Cryptologist", "Logbook", "Never at a Loss", "Polyglot", "Quick Study", "Well Versed", "Magpie"] },
		{ key: "insight", label: "Insight", moves: ["Attuned", "Deep Insight", "Countermeasures", "Sage Advice", "Let's Make a Deal"] },
	],
	"The Would-Be Hero": [
		{ key: "combat", label: "Combat", moves: ["Big Damn Hero", "Better Part of Valor", "Something to Remember Me By", "Undaunted", "Underestimated", "Anger is a Gift"] },
		{ key: "heart", label: "Heart", moves: ["In Over Your Head", "Inquiring Minds", "Speak Truth to Power", "Tough Love", "Up With People", "Voice of Experience"] },
		{ key: "grit", label: "Grit", moves: ["A Force to Be Reckoned With", "But I Get Up Again", "I Get Knocked Down", "Iron Will", "Never Gonna Keep Me Down", "Resourceful"] },
	],
};

// The chips (key + label only) to show for a playbook, or [] when none are defined.
export function moveGroupsForPlaybook(playbookName) {
	return (ONBOARDING_MOVE_GROUPS[playbookName] ?? []).map(g => ({ key: g.key, label: g.label }));
}

// The group keys a given move belongs to, within its playbook (0, 1, or more).
export function moveGroupKeys(playbookName, moveName) {
	return (ONBOARDING_MOVE_GROUPS[playbookName] ?? [])
		.filter(g => g.moves.includes(moveName))
		.map(g => g.key);
}
