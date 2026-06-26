// A constructed Taylor-origin character fixture, shaped from his data models
// (CharacterData + ArcanumData/PossessionData/OutfitItemData/NpcItemData) and his
// migrateCharacter.js. Stands in for a real exported actor so the Path B mappers can be
// validated field-by-field without standing up his whole system. `_source.system` mirrors
// how Foundry stores raw data (the fork's CharacterModel would strip his extra system.* keys
// on load, which is why Path B reads _source). Extend as more mappers land.
export const taylorCharacter = {
	name: "Brannan the Blessed",
	type: "character",
	// His characters use the bundled playbook portrait as the actor + token image (his asset paths).
	img: "systems/stonetop/assets/playbooks/the-blessed.png",
	prototypeToken: { texture: { src: "systems/stonetop/assets/playbooks/the-blessed.png" } },
	_source: {
		system: {
			playbookSlug: "the-blessed",
			background: { selected: "devoted" },
			origin:     { selected: "stonetop-born" },
			instinct:   { custom: "to serve Tor and the people" },
			lore: { values: {                                            // actor-level lore store
				"the-earth-mother": { "shrine-loved": 1, "shrine-token": 0 }, // shrine-token:0 = deselected → dropped
				"danu-offerings":   { figurines: 1, salt: 1 },
				// A text-type lore answer with his `-input` suffix (cross-playbook here, just to
				// exercise the text path + suffix-strip); the fork keys it plainly group:option.
				"the-relic":        { "where-acquired-input": "From a barrow under the Steplands." },
			} },
			choices:    { values: { instinct: { x: 1 } }, groupDefs: {} }, // pending: choices fan-out
			// resources.counts is 2-level { namespace: { slug: count } }. Only the inventory namespace
			// maps now (→ inventory.resources): item/arcana slugs + a deliberately-emptied 0 track.
			// backgrounds (→ background.setupResources) + moveResources (→ moves) are DEFERRED (crosswalk).
			resources:  { counts: {
				inventory:   { "sacred-pouch": 2, "torches": 0 },
				backgrounds: { "supplies": 4 },
			} },
			moveResources: { counts: { moves: { "spirit-tongue": 1 } } },
			inventory: {
				checked:     { "spear": true, "shield": true },
				regularPool: 3,
				smallPool:   1,
				loadLevel:   "normal",
				otherItems:  "a carved talisman",
			},
			stats: { str: { value: 0 }, dex: { value: 1 }, con: { value: 1 }, int: { value: -1 }, wis: { value: 2 }, cha: { value: 0 } },
			attributes: { level: 3, hp: { value: 18, max: 20 }, armor: 1, xp: { value: 4 } },
		},
	},
	items: [
		// His playbook item carries the playbook DEFS + the character's current-form choice selections
		// in its RAW source (the fork's PlaybookModel strips these from cleaned .system, so Path B reads
		// _source). Here: the instinct + appearance defs (slug→text/description) and a current-form
		// appearance selection. Instinct is left to the actor-level scalar path (system.instinct.custom)
		// in this fixture; buildInstinctMigration is exercised in its own tests.
		{ type: "playbook", system: { slug: "the-blessed" }, _source: { system: {
			slug: "the-blessed", actorType: "character",
			instinct: { slug: "instinct", list: [ { type: "pick", pickCount: 1, options: [
				{ slug: "delight",   text: "Delight",   description: "To find beauty, in even the ugliest things." },
				{ slug: "nurture",   text: "Nurture",   description: "To help others grow, learn, or improve." },
				{ slug: "reverence", text: "Reverence", description: "To honor the spirits and give them their due." },
			] } ] },
			appearance: { slug: "appearance", list: [
				{ type: "pick", pickCount: 1, options: [ { slug: "fresh-faced", text: "fresh-faced" }, { slug: "hale-and-hearty", text: "hale & hearty" }, { slug: "gray-and-wizened", text: "gray & wizened" } ] },
				{ type: "pick", pickCount: 1, options: [ { slug: "imperious-voice", text: "imperious voice" }, { slug: "raspy-voice", text: "raspy voice" }, { slug: "soothing-voice", text: "soothing voice" } ] },
				{ type: "pick", pickCount: 1, options: [ { slug: "curvy", text: "curvy" }, { slug: "strapping", text: "strapping" }, { slug: "solid", text: "solid" } ] },
				{ type: "pick", pickCount: 1, options: [ { slug: "ceremonial-robes", text: "ceremonial robes" }, { slug: "furs-leather", text: "furs, leather" }, { slug: "work-clothes", text: "work clothes" } ] },
			] },
			choiceValues: {
				appearance: { "hale-and-hearty": 1, "raspy-voice": 1, "curvy": 1, "work-clothes": 1 },
				// CURRENT-form lore: his merged the-earth-mother group (shrine opts + offering opts).
				// The crosswalk keeps shrine opts under the-earth-mother and splits offerings into the
				// fork's danu-offerings group. (figurines/salt are offerings; shrine-loved is a shrine opt.)
				"the-earth-mother": { "shrine-loved": 1, "figurines": 1, "salt": 1 },
			},
		} } },
		{ type: "move", system: { slug: "spirit-tongue", categoryKey: "playbook-the-blessed" } },
		// Major arcanum, flipped, with unlock + back-choice mark counts (nested by own slug).
		{ type: "arcanum", system: {
			slug: "sacred-pouch", major: true, flipped: true,
			unlockValues:     { "sacred-pouch": { "more-uses": 2, "wider-array": 1 } },
			backChoiceValues: { "sacred-pouch": { "dark-bargain": 1 } },
		} },
		// Minor arcanum, not flipped, no marks.
		{ type: "arcanum", system: { slug: "a-folktale", major: false, flipped: false, unlockValues: {}, backChoiceValues: {} } },
		// Possessions: one selected with uses + a per-choice use count.
		{ type: "possession", system: { slug: "sacred-pouch-poss", selected: true, uses: 3, choiceUses: { "healing-draught": 1 } } },
		{ type: "possession", system: { slug: "herb-garden", selected: false, uses: 0, choiceUses: {} } },
		// Outfit items the character holds.
		{ type: "outfitItem", system: { slug: "healers-kit" } },
		{ type: "outfitItem", system: { slug: "rations" } },
		// Followers (his `npc` items). His tagList/instinct/cost are Selection-raw objects;
		// armor is prose. One fully-populated individual follower, one with prose armor + empty
		// single-selects, and one NOT owned (a stat-block reference that must be skipped).
		{ type: "npc", name: "Loyal Hound", system: {
			slug: "loyal-hound", owned: true,
			tagList:  { selected: ["fierce", "tracker"], options: [], multi: true, allowCustom: true },
			hp:       { value: 4, max: 6 },
			armor:    "1",
			damage:   "d6",
			instinct: { selected: ["to protect the pack"], options: [], multi: false, allowCustom: true },
			cost:     { selected: ["affection"], options: [], multi: false, allowCustom: true },
			moves:    "- Sniff out danger\n- Stand guard",
			notes:    "Brannan's faithful companion.",
			loyalty:  { value: 2, max: 3 },
		} },
		{ type: "npc", name: "Old Sara", system: {
			slug: "old-sara", owned: true,
			tagList:  { selected: ["healer", "wise"], options: [], multi: true, allowCustom: true },
			hp:       { value: 5, max: 5 },
			armor:    "2 (leather)",
			damage:   "d4",
			instinct: { selected: [], options: [], multi: false, allowCustom: true },
			cost:     { selected: [], options: [], multi: false, allowCustom: true },
			loyalty:  { value: 0, max: 3 },
		} },
		{ type: "npc", name: "Wild Wolf", system: { slug: "wild-wolf", owned: false, hp: { value: 8, max: 8 } } },
		// Inserts. His choiceValues is { group: { option: scalar } } (number=count, string=text).
		// A post-death insert (Ghost): instinct pick (deferred), a terrible-purpose pick, and two
		// consequence marks — "breakdown" aligns with the fork, "carrion-stench" is a Taylor-only
		// consequence slug (kept verbatim; the fork ignores option slugs it lacks at render).
		{ type: "insert", system: {
			slug: "ghost",
			choiceValues: {
				instinct:           { denial: 1 },                      // deferred (composeInstinct reconciliation)
				"terrible-purpose": { longing: 1 },
				consequences:       { breakdown: 1, "carrion-stench": 1 },
			},
		} },
		// The invocations insert (a Lightbearer feature in both systems; option slugs are identical).
		// "blinding-light": 0 is a deselected sibling and must be excluded.
		{ type: "insert", system: {
			slug: "lightbearer-invocations-insert",
			choiceValues: {
				"lightbearer-invocations": { "dancing-light": 1, "warmth-of-the-sun": 1, "blinding-light": 0 },
			},
		} },
	],
};
