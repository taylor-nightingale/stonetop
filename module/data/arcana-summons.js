// Arcana that manifest creature(s) as followers — the arcana whose reverse says
// "Treat it/them as a follower" (Book II, The Things They Carried). Each entry's
// `followers` are buildCustomFollower() inputs; the character sheet's "Add as
// follower" button (templates/actor/partials/tab-arcana.hbs) turns them into custom
// follower cards via _onArcanaSummon. `sourceUuid` is a stable identity marker
// (`slug:creature`) so re-summoning never duplicates a card. Stat blocks are
// transcribed verbatim from each arcanum's reverse; OCR "(band)" damage tags are
// corrected to "(hand)". Variable summons (the beautiful scroll's tulpa, the rusty
// cauldron's chimera, the Ring's Servants of Daagon) ship a base card whose `notes`
// spell out the per-summon picks the player resolves on the card afterward.

export const ARCANA_SUMMONS = {
	"blackwood-fetishes": {
		followers: [
			{
				name:         "Astor",
				pronoun:      "they",
				typeLabel:    "bound spirit",
				portraitIcon: "fas fa-ghost",
				tags:         ["undead", "spirit", "hunter", "cunning", "jealous", "sarcastic", "warrior"],
				hp:           13,
				armor:        1,
				damage:       "ghostly spear d8 (reach, ignores armor)",
				instinct:     "to comply maliciously",
				moves:        "Stalk assigned prey\nManifest a ghostly presence (harmed only by silver or salt)\nMake a pessimistic observation",
				cost:         "proof of honor, nobility",
				notes:        "Armor 1 (lacks organs). Bound to obey your direct commands; can take no overt action against you, but Persuade them to do anything beyond your orders to the letter. Dismiss them and they return to their figurine; banished or reduced to 0 HP, both spirits return to their fetishes and can't be called forth again until the next new moon.",
				sourceUuid:   "blackwood-fetishes:astor",
			},
			{
				name:         "Halix",
				pronoun:      "they",
				typeLabel:    "bound spirit",
				portraitIcon: "fas fa-ghost",
				tags:         ["undead", "spirit", "magical", "hedonistic", "cautious", "devious", "stealthy", "exceptional"],
				hp:           10,
				armor:        1,
				damage:       "ghostly touch d4 (hand, ignores armor) or host's weapon d6",
				instinct:     "to second-guess your decisions",
				moves:        "Manifest a ghostly presence\nPossess an inebriated victim\nSpot a weakness, want, or fear\nSpin plots and falsehoods",
				cost:         "pleasures of the flesh",
				notes:        "Armor 1 (lacks organs). Bound to obey your direct commands; can take no overt action against you, but Persuade them to do anything beyond your orders to the letter. Dismiss them and they return to their figurine; banished or reduced to 0 HP, both spirits return to their fetishes and can't be called forth again until the next new moon.",
				sourceUuid:   "blackwood-fetishes:halix",
			},
		],
	},

	"beautiful-scroll": {
		followers: [
			{
				name:         "Tulpa",
				pronoun:      "it",
				typeLabel:    "tulpa",
				portraitIcon: "fas fa-hand-sparkles",
				tags:         ["spirit", "construct", "tiny", "naive"],
				hp:           8,
				armor:        0,
				damage:       "1d4 (if that)",
				moves:        "Manifest a form of dust/snow/vapor\nProduce light (area, reach)\nCarry/manipulate a ◇ item\nDeliver a message\nSpy on someone/something",
				notes:        "Your hand-made familiar — name it, then pick its extras: 2 more tags (eager / fierce / kind / sly / timid / willful), an instinct (to play / to learn / to flaunt), 2 more moves of your own, and a cost (respect given / new experiences / comfort & compassion).",
				sourceUuid:   "beautiful-scroll:tulpa",
			},
		],
	},

	"metal-man": {
		followers: [
			{
				name:         "Bronze Protector",
				pronoun:      "it",
				typeLabel:    "construct",
				portraitIcon: "fas fa-robot",
				tags:         ["construct", "spirit", "durable", "vigilant", "overbearing", "mute", "gullible"],
				hp:           13,
				armor:        3,
				damage:       "pummel 1d8 (hand)",
				instinct:     "to be overzealous in guarding you",
				moves:        "Loom menacingly, belching smoke\nStart fires, cause collateral damage\nRun low on fuel",
				cost:         "profuse gratitude",
				notes:        "Armor 3 (metal). Special qualities: fireproof; holds +1 Readiness on a 7+ to Defend; requires a smithy and tools to regain HP. The hearth spirit animates it only as long as fire burns in its stove-like chest.",
				sourceUuid:   "metal-man:bronze-protector",
			},
		],
	},

	"cloak-richly-embroidered": {
		followers: [
			{
				name:         "The Spirit in the Cloak",
				pronoun:      "it",
				typeLabel:    "spirit",
				portraitIcon: "fas fa-cloud",
				tags:         ["spirit", "magical", "proud", "mute"],
				hp:           13,
				armor:        1,
				damage:       "lashing wind, rain, debris d6 (near, area)",
				instinct:     "to \"not hear\" your commands",
				moves:        "Bear its master aloft on a cushion of swirling winds\nManifest a storm as it flies\nWreak havoc on its surroundings\nFling lightning from a raging storm, d10+3 (far, forceful, reload)",
				cost:         "flying about for hours",
				notes:        "Armor 1 (amorphous). It never wants to land; spend its Loyalty or Persuade it to do otherwise.",
				sourceUuid:   "cloak-richly-embroidered:storm-spirit",
			},
		],
	},

	"cracked-flute": {
		followers: [
			{
				name:         "The Andalau of the Flute",
				pronoun:      "it",
				typeLabel:    "spirit",
				portraitIcon: "fas fa-wind",
				tags:         ["spirit", "tiny", "stealthy", "mischievous"],
				hp:           8,
				armor:        0,
				damage:       "none",
				instinct:     "to play and frolic",
				moves:        "Manifest as a fluttering gust of wind (harmed only by salt)\nDeliver a whispery message\nFlit things about (dust, leaves, etc.)\nAnnoy or spook someone",
				cost:         "entertainment",
				loyalty:      1,
				notes:        "Tied to the cracked flute; holds 1 Loyalty to start. Dismiss it while it holds no Loyalty and the flute splits and falls apart, setting the andalau free.",
				sourceUuid:   "cracked-flute:andalau",
			},
		],
	},

	"demonhide-cloak": {
		followers: [
			{
				name:         "The Cloak",
				pronoun:      "it",
				typeLabel:    "cloak (follower)",
				portraitIcon: "fas fa-mask",
				tags:         ["bloodthirsty", "demon-wise", "extraordinary", "magical"],
				hp:           0,
				armor:        0,
				damage:       "none",
				instinct:     "to bicker and argue (with you, with itself)",
				moves:        "Reveal a dark and terrible secret, or part of one\nManifest a minor demonic effect\nPossess you in your sleep",
				cost:         "chaos and wanton destruction",
				notes:        "The Demonhide Cloak itself, now a follower. When you would mark a Consequence, you can spend 1 of the Cloak's Loyalty instead.",
				sourceUuid:   "demonhide-cloak:the-cloak",
			},
		],
	},

	"mindgem": {
		followers: [
			{
				name:         "The Mighty Servant",
				pronoun:      "it",
				typeLabel:    "construct",
				portraitIcon: "fas fa-mountain",
				tags:         ["large", "construct", "Maker-wise", "beautiful", "meek", "hardy", "slow", "strong", "exceptional"],
				hp:           24,
				armor:        4,
				damage:       "stone fists d10+1 (hand, close, disadvantage)",
				instinct:     "to misunderstand",
				moves:        "Perform a mighty feat of strength\nCarry on implacably",
				cost:         "wonder, excitement, joy, discovery",
				notes:        "Special qualities: living stone, tireless. When it makes a move at your behest and rolls a 6-, mark a Consequence — the Mindgem's reverse lists how it changes (new tags/moves, shifting damage, or developing a purpose of its own).",
				sourceUuid:   "mindgem:mighty-servant",
			},
		],
	},

	"oversized-crown": {
		followers: [
			{
				name:         "Void elemental",
				pronoun:      "it",
				typeLabel:    "elemental",
				portraitIcon: "fas fa-circle",
				tags:         ["spirit", "primordial", "confused", "angry"],
				hp:           15,
				armor:        1,
				damage:       "void touch 1d10 w/advantage (hand, grabby, ignores armor)",
				instinct:     "to rage at all the noise and chaos",
				moves:        "Manifest as a black hole in reality\nSnuff out a source of energy\nBecome confused, unsure what to do",
				cost:         "profuse gratitude",
				loyalty:      3,
				notes:        "Armor 1 (lacks organs). Special qualities: immune to most harm. Starts with 3 Loyalty and can never gain more. Speak the Words of Unbeing to send it back to the void—if it wants to go.",
				sourceUuid:   "oversized-crown:void-elemental",
			},
		],
	},

	"scroll-and-bone-flute": {
		followers: [
			{
				name:         "Dool spirit",
				pronoun:      "it",
				typeLabel:    "spirit",
				portraitIcon: "fas fa-skull",
				tags:         ["spirit", "terrifying", "stealthy", "devious"],
				hp:           13,
				armor:        1,
				damage:       "feast on fear d8 (close, hand, ignores armor, disadvantage)",
				instinct:     "to take things too far",
				moves:        "Sense a victim's doubt and worries\nShape sound and shadow to unnerve and frighten\nManifest as its victim's fears (harmed only by one who masters their fear)",
				cost:         "new, exquisite fears",
				notes:        "Armor 1 (amorphous). Special qualities: powerless in bright light. Only one dool spirit will serve you at a time.",
				sourceUuid:   "scroll-and-bone-flute:dool-spirit",
			},
		],
	},

	"stone-idol": {
		followers: [
			{
				name:         "All-mighty Thistlewik",
				pronoun:      "it",
				typeLabel:    "fae",
				portraitIcon: "fas fa-frog",
				tags:         ["fae", "tiny", "magical", "devious", "arrogant"],
				hp:           15,
				armor:        6,
				damage:       "none",
				instinct:     "to heap abuse on its worshippers",
				moves:        "Make unreasonable demands\nConsume the essence of foodstuffs\nSense one's idle thoughts/memories\nWeave powerful illusions and hallucinations (near, area)\nGrow bored/huffy and go to sleep",
				cost:         "obeisance and ever-larger offerings of food",
				notes:        "Armor 6 (stone, resilience), 2 vs. iron. Special qualities: inert; indistinguishable voice. It hardly considers itself a follower.",
				sourceUuid:   "stone-idol:thistlewik",
			},
		],
	},

	"tattered-mantle": {
		followers: [
			{
				name:         "Mantle wraiths",
				pronoun:      "they",
				typeLabel:    "wraith group",
				portraitIcon: "fas fa-ghost",
				tags:         ["group (3)", "spirit", "undead", "terrifying", "vicious"],
				hp:           13,
				armor:        1,
				damage:       "life drain d8 (hand, ignores armor)",
				instinct:     "to run rampant",
				moves:        "Whisper their longings to the weaver\nManifest a form of shadow and cold (harmed only by silver and salt)\nHurl themselves at the living\nSuck the vitality from their prey",
				cost:         "souls feasted upon",
				notes:        "Group of 3. Armor 1 (amorphous). Special qualities: powerless in daylight. They are loathe to return to the mantle; spend their Loyalty or Persuade them.",
				sourceUuid:   "tattered-mantle:mantle-wraiths",
			},
		],
	},

	"rusty-cauldron": {
		followers: [
			{
				name:         "Unliving chimera",
				pronoun:      "it",
				typeLabel:    "construct",
				portraitIcon: "fas fa-paw",
				tags:         ["undead", "construct", "terrifying", "clumsy"],
				hp:           3,
				armor:        4,
				damage:       "varies d6 (hand, maybe others)",
				instinct:     "to get confused and lash out",
				moves:        "Do something one of its component beasts could do\nMoan, wretchedly and disturbingly",
				cost:         "lots of fresh blood",
				notes:        "Armor 4 (0 vs. bronze). Add a tag for each beast whose bones you used (bear-like, owl-like, etc.). For each debility you marked when raising it (up to 3), pick 1: it is stable (else it falls apart in a day); it is not clumsy; replace its instinct with \"to shun light.\"",
				sourceUuid:   "rusty-cauldron:unliving-chimera",
			},
		],
	},

	"ring-of-daagon": {
		followers: [
			{
				name:         "Ring of Daagon",
				pronoun:      "it",
				typeLabel:    "ring (follower)",
				portraitIcon: "fas fa-ring",
				tags:         ["deep-wise", "greedy", "patient", "knowledgeable", "magical"],
				hp:           0,
				armor:        0,
				damage:       "none",
				instinct:     "to give nothing (not even secrets or info) away",
				moves:        "Speak mind-to-mind\nReveal a secret, for a price\nKnow someone's desires",
				cost:         "devouring fallen, named creatures",
				notes:        "The Ring itself, now a follower. Servants of Daagon you Call Up share a pool of Loyalty with the Ring.",
				sourceUuid:   "ring-of-daagon:the-ring",
			},
			{
				name:         "Servant of Daagon",
				pronoun:      "it",
				typeLabel:    "deep one",
				portraitIcon: "fas fa-fish",
				tags:         ["terrifying", "violent", "wretched"],
				hp:           6,
				armor:        0,
				damage:       "d8",
				instinct:     "to devour",
				cost:         "shares the Ring's Loyalty",
				// You Call Up a fresh batch of Servants each time, so this card can be
				// added again and again — never deduped by sourceUuid (see _onArcanaSummon).
				repeatable:   true,
				notes:        "Base 'group' build — adjust this card to your roll. Each Call Up, roll five d4s and assign each to one aspect:\n• Tags: 1 +craven; 2 +ravenous; 3 +cunning; 4 +exceptional (roll +2 for moves).\n• No. Appearing: 1 horde (2d6, HP 3, d6); 2-3 group (1d6+1, HP 6, d8); 4 solitary (HP 12, d10).\n• Size: 1 small (-2 HP, -2 damage, hand); 2-3 medium (close); 4 large (+4 HP, +1 damage, close, reach).\n• Traits (choose N = assigned die): blubbery/scaly hide (2 armor) / +stealthy & +cautious / powerful (+2 damage, forceful) / tentacles, pincers (reach, grabby) / big claws, fangs (1 piercing, messy) / projectiles (+near).\n• Moves (choose N = assigned die): Wriggle free / Heal at a prodigious rate / Smother, constrict, engulf / Dissolve organic material / Mesmerize the weak-willed / Paralyze with venom.",
				sourceUuid:   "ring-of-daagon:servant-of-daagon",
			},
		],
	},
};

/** The summon definition for an arcanum slug, or null if it manifests no follower. */
export function arcanaSummon(slug) {
	return ARCANA_SUMMONS[slug] ?? null;
}

/** True if the arcanum manifests one or more followers. */
export function hasArcanaSummon(slug) {
	return !!ARCANA_SUMMONS[slug];
}

// Join names for display: ["Astor","Halix"] → "Astor & Halix"; three or more use an
// Oxford-free serial comma ("A, B & C"). Drives the summon button label and confirm.
export function joinNames(names) {
	const list = (names ?? []).filter(Boolean);
	if (list.length <= 1) return list[0] ?? "";
	if (list.length === 2) return `${list[0]} & ${list[1]}`;
	return `${list.slice(0, -1).join(", ")} & ${list[list.length - 1]}`;
}
