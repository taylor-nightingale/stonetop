import {resolvedFlagProperty, STONETOP_SCOPE} from "../character/StonetopFlags.js";
import {slugify} from "../../utils/strings.js";
import {OCCUPATIONS, TRAITS, HOMES} from "../../data/steading-members.js";

export const IMPROVEMENT_DEFINITIONS = [
	// ── Page 2 ──────────────────────────────────────────────────
	{
		slug: "additionalHousing",
		label: "Additional Housing",
		flavor: "It's getting crowded! We need more room to live.",
		sections: [
			{
				heading: "Requires either one of these:",
				min: 1,
				items: [
					"An exceptional engineer/foreman, to design much roomier houses on the current land",
					"Building on parts of the fields, resulting in −1 Surplus generated with each autumn's harvest",
				],
			},
			{
				heading: "And then — <em>Pulling Together</em> 5 times, each requiring 1 season, 1 Surplus, and a wagonload of timber and other supplies (Value 2), to (re)build homes:",
				items: [
					"<em>Pull Together</em> (1st)",
					"<em>Pull Together</em> (2nd)",
					"<em>Pull Together</em> (3rd)",
					"<em>Pull Together</em> (4th)",
					"<em>Pull Together</em> (5th)",
				],
			},
		],
		effect: "Increase Fortunes by 1 and add any new homes to the map. Henceforth, when you consume Surplus in winter, consider Population to be 1 lower than it is.",
	},
	{
		slug: "aurochsHunting",
		label: "Aurochs Hunting",
		flavor: "Large herds form on the Flats in spring. The Hillfolk hunt them, but Stonetop has never learned to do so.",
		sections: [
			{
				heading: "Requires 2 of the following:",
				min: 2,
				items: [
					"A Herd of Horses (and hunters to ride them)",
					"Cooperating with the Hillfolk",
					"A cunning plan",
				],
			},
			{
				heading: "And then:",
				items: ["A successful first hunt (played out in detail)"],
			},
		],
		effect: "Add \"Aurochs hunting (meat, hide, horn)\" to the Resources list. Henceforth, when you lead the aurochs hunt in spring, roll +Defenses: on a 10+, gain 1d4 Surplus; on a 7–9, gain 1d4 Surplus but pick 1 from the list below; on a 6–, pick 1 from the list below, or pick 2 and gain 1d4 Surplus. The list: 1d4 of the town's horses are lamed or killed; a number of locals are injured and the steading marks <em>diminished</em> (disadvantage to <em>Deploy</em>, <em>Muster</em>, or <em>Pull Together</em>); the GM picks an NPC present for the hunt — they are killed; the Hillfolk are somehow offended; the herd is weak and if you hunt next year they'll be wiped out.",
	},
	{
		slug: "expandedTrades",
		label: "Expanded Trades",
		flavor: "Specialization is the key to prosperity!",
		sections: [
			{
				heading: "Requires one of the following improvements, to free up enough time to support more tradesfolk:",
				min: 1,
				items: [
					"Harnessing the Stream",
					"Raincatching",
					"Mill",
				],
			},
			{
				heading: "And establishing at least 3 of the following:",
				min: 3,
				items: [
					"A chandler with extensive tools and supplies (Value 3)",
					"A glassblower with a full glassworks (Value 3)",
					"An exceptional weaver with good tools (Value 2) and a reliable supply of Whitefang wool",
					"An exceptional potter with good tools (Value 2) and a reliable source of excellent clay",
					"An exceptional smith with a newer, hotter forge (Value 3)",
					"Some other exceptional tradesperson, with the appropriate tools and supplies (Value 2 or 3)",
				],
			},
		],
		effect: "Increase Prosperity by 1. If you cease to meet the requirements, decrease Prosperity by 1.",
	},
	{
		slug: "greaterHarvest",
		label: "Greater Harvest",
		flavor: "Beyond the Old Wall, the prairie grass of the Flats chokes out any crops we try to grow.",
		sections: [
			{
				heading: "Requires 1 of the following:",
				min: 1,
				items: [
					"Doubling the yield of crops inside the Old Wall",
					"Clearing/taming new fields beyond the Old Wall",
				],
			},
		],
		effect: "Increase Fortunes by 1. Henceforth, when the autumn harvest is complete, gain +1d4 Surplus.",
	},
	{
		slug: "harnessingStream",
		label: "Harnessing the Stream",
		flavor: "A shallow creek flows just below the town. If only it could be harnessed!",
		sections: [
			{
				heading: "Requires 2 of the following:",
				items: [
					"A reservoir for the Stream to pool in, and some way for water to flow uphill",
					"A series of aqueducts, from the Stream's source to Stonetop",
				],
			},
		],
		effect: "Add them to the Resources list and increase Fortunes by 1. Henceforth, when spring breaks forth and you roll a 7+ with Fortunes, the steading generates 1 Surplus.",
	},
	{
		slug: "herdOfHorses",
		label: "Herd of Horses",
		flavor: "Imagine what we could do with a dozen fine steeds.",
		sections: [
			{
				heading: "Requires all of the following:",
				items: [
					"A site for a proper stable and corral",
					"<em>Pulling Together</em> to build the stable and corral, which requires a month and a wagonload of timber (Value 2). Add them to the map.",
					"Someone skilled in riding and training horses",
					"Acquiring a small herd of horses, about a dozen (through trade or by catching wild ones)",
					"Training/breaking them to the saddle and plow",
					"Additional saddles, harness, plows, etc. (Value 2)",
					"<em>Pulling Together</em> to have a couple dozen villagers learn to ride, requiring a season and 1 Surplus.",
					"Someone to mind the herd and stable, full time",
				],
			},
		],
		effect: "Increase Fortunes by 1 and replace \"a pair of sturdy draft horses\" with \"a herd of horses\" on the Assets list. Make a note of its size. Henceforth: When you leverage the horses to <em>Pull Together</em>, it takes half as long and costs half as much. When you <em>Requisition</em> half the herd or less, treat a 6– as a 7–9. When the <em>Seasons Change</em> to summer, any yearlings become horses (Value 3 once trained), any foals become yearlings (Value 2), and the herd gains foals (Value 1) equal to 1d4+Fortunes (min 0). When winter grips the land, the herd consumes 1 Surplus per 6 grown or yearling horses. For every Surplus not consumed, 1d6 horses are lost.",
	},
	{
		slug: "heroicReputation",
		label: "Heroic Reputation",
		flavor: "Few have heard of Stonetop's heroes. Yet.",
		sections: [
			{
				heading: "Requires any 3 of the following:",
				min: 3,
				items: [
					"Impressing a band of Hillfolk",
					"Braving a lake and coming back with proof",
					"Saving many Marshedge residents' lives",
					"Saving many Gordin's Delve residents' lives",
					"Saving someone from beyond Marshedge",
					"Hiring a minstrel to tell your tales (Value 2)",
				],
			},
		],
		effect: "When you first meet someone from beyond Stonetop, roll +Fortunes: on a 10+, say what they've heard about you or Stonetop, and gain advantage on your next move against them; on a 7–9, say what they've heard; on a 6–, the GM decides what they've heard.",
	},
	// ── Page 3 ──────────────────────────────────────────────────
	{
		slug: "inn",
		label: "Inn",
		flavor: "The public house offers a common room and shelter for a few horses, but it's hardly a proper inn.",
		sections: [
			{
				heading: "Requires all of the following, in order:",
				items: [
					"A designated building site",
					"A competent engineer/foreman",
					"Furnishings, equipment, and material (Value 3)",
					"<em>Pulling Together</em> (1st — 1 season, 1 Surplus, and timber/supplies, Value 2)",
					"<em>Pulling Together</em> (2nd — 1 season, 1 Surplus, and timber/supplies, Value 2)",
					"A small, devoted staff (innkeep, cook, ostler, etc.)",
				],
			},
		],
		effect: "Increase Fortunes by 1. Name the inn, add it to both the Resources list and map. Henceforth, when the <em>Seasons Change</em>, whoever is friendliest rolls +Fortunes: on a 10+, ask the GM 3 questions about the wider world; on a 7–9, ask 1 question; on a 6–, ask 1 question, but the GM describes some trouble that stems from the inn or its guests. Once per season, when you expend 1 Surplus and bring folks together at the inn (to talk, to celebrate, to recuperate), clear one of the steading's debilities.",
	},
	{
		slug: "market",
		label: "Market",
		flavor: "Stonetop is at most an afterthought for traders in the region. We need to change that.",
		sections: [
			{
				heading: "Requires 1 of the following:",
				min: 1,
				items: [
					"A compelling good/service, exclusive to Stonetop",
					"Establishing some other reason to visit Stonetop (place of pilgrimage, etc.)",
				],
			},
			{
				heading: "And these:",
				items: [
					"A dedicated market site (add it to the map)",
					"A trusted arbiter, able to enforce their own rulings on matters of trade",
					"Four seasons in operation without notable incidents of violence, banditry, theft, etc.",
				],
			},
		],
		effect: "Increase Prosperity by 1. If you cease to meet the requirements, decrease Prosperity by 1. When the <em>Seasons Change</em> to spring, summer, or autumn and the market is active, and Population is +1 or better, the Market generates 1 Surplus.",
	},
	{
		slug: "mill",
		label: "Mill",
		flavor: "We've got our pick of millstones. With a mill, we'd have better bread and more time for other crafts.",
		sections: [
			{
				heading: "Requires all of the following:",
				items: [
					"An exceptional engineer/foreman",
					"A convenient, consistent power source (wind on a hill, a waterwheel, a Herd of Horses, magic, etc.)",
					"A building site able to harness that power source",
					"<em>Pulling Together</em> (1st — a season, 1 Surplus, a wagonload of timber, Value 2, and a bunch of rope and supplies, Value 2)",
					"<em>Pulling Together</em> (2nd — a season, 1 Surplus, a wagonload of timber, Value 2, and a bunch of rope and supplies, Value 2)",
					"A full-time miller",
				],
			},
		],
		effect: "Increase Fortunes by 1, add \"Mill\" to the Resources list and draw it on the map. Henceforth, when the autumn harvest is complete, the steading generates +1 Surplus. Also, when you <em>Outfit</em> from Stonetop or <em>Have What You Need</em> after doing so, each ◆ of supplies has 1 extra use.",
	},
	{
		slug: "palisade",
		label: "Palisade",
		flavor: "A wall of sharpened logs, 10' tall, to keep evil at bay.",
		sections: [
			{
				heading: "Requires all of the following, in order:",
				items: [
					"Lots of timber (~20–25 wagonloads, Value 3)",
					"A competent engineer/foreman",
					"Lots of rope, nails, pitch, etc. (Value 2)",
					"<em>Pulling Together</em>, costing a month and 1 Surplus",
				],
			},
		],
		effect: "Increase Fortunes by 1, add \"Palisade\" to the Fortifications list and draw it on the map. Henceforth, when you take advantage of the palisade, you have advantage to <em>Deploy</em>.",
	},
	{
		slug: "raincatching",
		label: "Raincatching",
		flavor: "Filling the cistern takes so much work. Surely, we can do better!",
		sections: [
			{
				heading: "Requires all of the following, in order:",
				items: [
					"An exceptional engineer/foreman, to design a cunning system of roofs, gutters, and conduits",
					"Enough slate/terracotta to roof all the buildings and construct the gutters and conduits (Value 3)",
					"<em>Pulling Together</em> (1st — 1 season and 1 Surplus)",
					"<em>Pulling Together</em> (2nd — 1 season and 1 Surplus)",
					"<em>Pulling Together</em> (3rd — 1 season and 1 Surplus)",
				],
			},
		],
		effect: "Increase Fortunes by 1, add \"Raincatching\" to the Resources list. Henceforth, when summer comes and you roll a 7+ with Fortunes, the steading generates 1 Surplus.",
	},
	{
		slug: "standingWatch",
		label: "Standing Watch",
		flavor: "Some full-time warriors would make us all safer, no?",
		sections: [
			{
				heading: "Requires all of the following:",
				items: [
					"A veteran warrior, able to command a crowd",
					"At least 6 warriors, well-equipped and willing",
					"The village leaders agreeing to support warriors who train and keep watch full-time",
				],
			},
		],
		effect: "Add \"standing watch\" to the Fortifications list. At the start of each season, the watch consumes 1 Surplus or it disbands. When you specifically involve the watch in a move, treat Defenses as 1 higher than they are.",
	},
	{
		slug: "stoneWall",
		label: "Stone Wall",
		flavor: "No mere palisade of wood, but a mighty rampart. We have the stone, after all...",
		sections: [
			{
				heading: "Requires all of the following, in order:",
				items: [
					"An exceptional engineer/foreman",
					"A stonecutter with an able crew",
					"Equipment, tools, and material (Value 3)",
					"<em>Pulling Together</em> (1st — 1 season, 1 Surplus, and supplies, Value 2)",
					"<em>Pulling Together</em> (2nd — 1 season, 1 Surplus, and supplies, Value 2)",
					"<em>Pulling Together</em> (3rd — 1 season, 1 Surplus, and supplies, Value 2)",
					"<em>Pulling Together</em> (4th — 1 season, 1 Surplus, and supplies, Value 2)",
				],
			},
		],
		effect: "Add \"Stone Wall\" to the Fortifications list (erase \"Palisade\" if you had it) and draw it on the map. Henceforth: When you take advantage of the stone wall, you have advantage to <em>Deploy</em>. When winter grips the land, the steading consumes 1 less Surplus than normal.",
	},
	{
		slug: "township",
		label: "Township",
		flavor: "Will this ever be more than a backwater village?",
		sections: [
			{
				heading: "Requires all of the following:",
				items: [
					"Population +3 for 4 consecutive seasons (1st season)",
					"Population +3 for 4 consecutive seasons (2nd season)",
					"Population +3 for 4 consecutive seasons (3rd season)",
					"Population +3 for 4 consecutive seasons (4th season)",
					"Additional Housing",
					"Raincatching OR Harnessing the Stream",
					"At least 4 other improvements (1st)",
					"At least 4 other improvements (2nd)",
					"At least 4 other improvements (3rd)",
					"At least 4 other improvements (4th)",
					"A formal government of some sort",
				],
			},
		],
		effect: "Change Size to town and its Population to +0. Henceforth: When you <em>Muster</em>, <em>Pull Together</em>, or <em>Trade & Barter</em>, you have advantage. When the <em>Seasons Change</em> to spring or summer, the town generates Surplus equal to Population+1. But, when winter grips the land, roll 2d6+Population to consume Surplus instead of 1d4+Population.",
	},
	{
		slug: "weaponsOfWar",
		label: "Weapons of War",
		flavor: "Spears are great, but how about axes, picks, swords?",
		sections: [
			{
				heading: "Requires either this:",
				group: "weapons-source",
				items: [
					"Acquiring a few dozen good swords, battleaxes, maces, flails, warhammers, etc. (Value 3)",
				],
			},
			{
				heading: "Or all of these:",
				group: "weapons-source",
				items: [
					"A smith, with a full staff and upgraded tools (Value 2)",
					"A cartload of good iron ore (Value 2)",
					"4 seasons of work by the smith (1st season)",
					"4 seasons of work by the smith (2nd season)",
					"4 seasons of work by the smith (3rd season)",
					"4 seasons of work by the smith (4th season)",
				],
			},
			{
				heading: "And then:",
				items: [
					"A veteran warrior, able to command a crowd",
					"<em>Pulling Together</em> to train the militia with these new weapons, requiring a season and 1 Surplus",
				],
			},
		],
		effect: "Increase Defenses by 1 and add \"Weapons of War\" to the Fortifications list. Each spring, the village must expend 1 Surplus to maintain and replace the town's weapons. Henceforth, when you <em>Outfit</em> from Stonetop or <em>Have What You Need</em> after doing so, you can treat maces, flails, battleaxes, warhammers, and all types of swords as common items, as if they were already on the inventory inserts. Battleaxes and swords have \"x piercing,\" where x is the steading's current Prosperity.",
	},
	{
		slug: "wellTrainedMilitia",
		label: "Well-Trained Militia",
		flavor: "Everyone can use a spear and shield, but some hard drilling could make us a force to be reckoned with.",
		sections: [
			{
				heading: "Requires 1 of the following:",
				items: ["A veteran warrior, able to command a crowd"],
			},
			{
				heading: "For each tactic below, you must then <em>Pull Together</em>, requiring a season of drills and 1 Surplus:",
				min: 1,
				items: [
					"Archery: barrages, ranged ambushes, sniping, etc.",
					"Cavalry (requires a Herd of Horses): fighting from horseback, charges",
					"Formations: shield walls, wedges, phalanx, etc.",
					"Readiness: patrolling, reacting quickly to alarms",
					"Skirmishing: ambushes, harassing, hit-and-run",
				],
			},
		],
		effect: "When you <em>Deploy</em> using one of the militia's trained tactics, you are likely acting from a position of strength (you pick the consequence on a 7–9, not the GM). When the militia has trained in 2+ tactics, increase Defenses by 1. Each summer, the militia must spend 1 Surplus and a week or so practicing or else lose its training in 1 tactic.",
	},
];

/** Lower-cased built-in improvement labels, used to reject custom dupes of a book improvement. */
const BUILTIN_IMPROVEMENT_LABELS = new Set(IMPROVEMENT_DEFINITIONS.map(d => d.label.toLowerCase()));

/** How many of a requirement section's items must be checked (defaults to all). */
function sectionRequiredCount(section) {
	return Number.isFinite(section?.min) ? section.min : (section?.items?.length ?? 0);
}

/**
 * Whether every requirement group of an improvement is satisfied by its flat,
 * in-order stored checkbox state `r`. A section's `min` is how many of its items
 * must be checked (defaulting to all of them). Sections that share a `group` id
 * are alternatives (OR) — the group is met if any of them meets its count;
 * ungrouped sections each stand on their own (AND). An improvement with no
 * requirement sections is always met.
 * @param {{sections?: Array}} def
 * @param {Array<boolean>} r
 */
export function improvementRequirementsMet(def, r = []) {
	const groups = new Map();
	let idx = 0;
	(def?.sections ?? []).forEach((section, i) => {
		const items = section?.items ?? [];
		let checked = 0;
		for (let k = 0; k < items.length; k++) if (r[idx++]) checked++;
		const satisfied = checked >= sectionRequiredCount(section);
		const key = section?.group ?? `__${i}`;
		groups.set(key, (groups.get(key) ?? false) || satisfied);
	});
	return [...groups.values()].every(Boolean);
}

export const STEADING_DEFAULTS = {
	resources: [
		{ name: "Farming (beans, potatoes, oats, barley)", checked: true },
		{ name: "Hunting/trapping (fur, meat, hides)", checked: true },
		{ name: "Distilling (whisky)", checked: true },
		{ name: "Stone (collected from the Old Wall)", checked: true },
		{ name: "Cistern (filled with rain, snow)", checked: true },
		{ name: "Tradesfolk (midwife, potter, publican, smith, tanner)", checked: true },
		{ name: "Trade: Gordin's Delve (metal, tools)", checked: true },
		{ name: "Trade: Marshedge (textiles, herbs, glass)", checked: true },
		{ name: "", checked: false },
		{ name: "", checked: false },
		{ name: "", checked: false },
	],
	fortifications: [
		{ name: "Village militia", checked: true },
		{ name: "The Ringwall (low, stone)", checked: true },
		{ name: "3 watchtowers", checked: true },
		{ name: "Spears & shields in every home", checked: true },
		{ name: "Some bows", checked: true },
		{ name: "", checked: false },
		{ name: "", checked: false },
		{ name: "", checked: false },
		{ name: "", checked: false },
	],
	assets: [
		{ name: "A pair of hardy draft horses — HP 10 each; d6+3 dmg (hand, close, forceful); Instinct: to panic; Cost: care & grooming", checked: true },
		{ name: "A pair of horse-drawn plows, iron", checked: true },
		{ name: "A pair of carts (plus horse harness)", checked: true },
		{ name: "A wagon (plus horse harness)", checked: true },
		{ name: "", checked: false },
		{ name: "", checked: false },
		{ name: "", checked: false },
		{ name: "", checked: false },
	],
	// Start empty — residents/neighbors are added on demand via "Add Resident/
	// Neighbor" (or by typing into a row in edit mode). Seeding blank rows here
	// made three empty rows appear whenever a fresh sheet's section was edited.
	residents: [],
	neighbors: [],
	players: [],
	places: [
		{ letter: "A", name: "The Stone" },
		{ letter: "B", name: "The Granary" },
		{ letter: "C", name: "Public House & Stables" },
		{ letter: "D", name: "Cistern" },
		{ letter: "E", name: "Pavilion of the Gods" },
		{ letter: "F", name: "Watchtowers" },
		{ letter: "G", name: "" },
		{ letter: "H", name: "" },
		{ letter: "I", name: "" },
		{ letter: "J", name: "" },
		{ letter: "K", name: "" },
		{ letter: "L", name: "" },
		{ letter: "M", name: "" },
		{ letter: "N", name: "" },
		{ letter: "O", name: "" },
		{ letter: "P", name: "" },
		{ letter: "Q", name: "" },
		{ letter: "R", name: "" },
	],
	notes: "",
	improvements: {},
	size: "village",
	silver: { purses: 0, handfuls: 0, coins: 0 },
	gold:   { purses: 0, handfuls: 0, coins: 0 },
};

const SYSTEM_DEFAULTS = {
	stats: {
		fortunes: { value: 1 },
		defenses: { value: 0 },
	},
	attributes: {
		population: { value: 0 },
		prosperity: { value: 0 },
		surplus: { value: 1 },
		debilities: {
			options: {
				diminished: { value: false },
				lacking: { value: false },
				malcontent: { value: false },
			},
		},
	},
};

function _getProperty(obj, path) {
	return foundry.utils.getProperty(obj, path);
}

function _systemValue(actor, flags, path, defaultValue) {
	const flagValue = _getProperty(flags, `system.${path}`);
	if (flagValue !== undefined) return flagValue;
	const actorValue = _getProperty(actor.system, path);
	return actorValue !== undefined ? actorValue : defaultValue;
}

export class StonetopSteading {
	constructor(actor) {
		this._actor = actor;
		this.type = "stonetop";
	}

	get _flags() {
		return resolvedFlagProperty(this._actor, "steading") ?? {};
	}

	async setFlags(updates) {
		const current = foundry.utils.deepClone(this._flags);
		const merged = { ...current, ...updates };
		await this._actor.setFlag(STONETOP_SCOPE, "steading", merged);
	}

	getSystemValue(path, defaultValue = 0) {
		return _systemValue(this._actor, this._flags, path, defaultValue);
	}

	async setSystemValue(path, value, options = {}) {
		await this.setSystemValues({ [path]: value }, options);
	}

	/** Write several `system.*` values (and their mirrored steading-flag copies) in a
	 *  single actor update, so move-driven batches (e.g. Seasons Change) produce one
	 *  ledger append and one combined stat-change card rather than one per field. */
	async setSystemValues(updates, options = {}) {
		const data = {};
		for (const [path, value] of Object.entries(updates)) {
			data[`system.${path}`] = value;
			data[`flags.${STONETOP_SCOPE}.steading.system.${path}`] = value;
		}
		await this._actor.update(data, options);
	}

	getStatValue(statKey) {
		const attrKeys = { population: 0, prosperity: 0, surplus: 1 };
		if (statKey in attrKeys) {
			return Number(this.getSystemValue(`attributes.${statKey}.value`, attrKeys[statKey]));
		}
		const statDefaults = { fortunes: 1, defenses: 0 };
		return Number(this.getSystemValue(`stats.${statKey}.value`, statDefaults[statKey] ?? 0));
	}

	/** Slug for a journal-sourced custom improvement, namespaced so it never collides
	 *  with the camelCase built-in slugs and so re-dropping the same card is idempotent. */
	_customImprovementSlug(name) {
		return `custom-${slugify(name)}`;
	}

	/**
	 * Add a journal-sourced steading improvement (dropped from a bestiary-style card)
	 * as a tracked custom improvement. The definition is normalized into the same
	 * shape as IMPROVEMENT_DEFINITIONS so the snapshot/template treat it identically.
	 * No-op (returns `{ ok: false }`) when the name is empty or already present (by
	 * built-in label or existing custom slug), so re-dropping the same card is safe.
	 * @param {{name:string, flavor?:string, effect?:string, sections?:Array}} def
	 */
	async addCustomImprovement(def) {
		const name = String(def?.name ?? "").trim();
		if (!name) return { ok: false, reason: "empty" };

		const slug = this._customImprovementSlug(name);
		const existing = this._flags.customImprovements ?? [];
		if (BUILTIN_IMPROVEMENT_LABELS.has(name.toLowerCase()) || existing.some(d => d.slug === slug)) {
			return { ok: false, reason: "duplicate", slug, label: name };
		}

		const normalized = {
			slug,
			label: name,
			flavor: String(def.flavor ?? ""),
			sections: (Array.isArray(def.sections) ? def.sections : []).map(s => ({
				heading: String(s?.heading ?? ""),
				items: (Array.isArray(s?.items) ? s.items : []).map(String),
			})),
			effect: String(def.effect ?? ""),
		};
		await this.setFlags({ customImprovements: [...existing, normalized] });
		return { ok: true, slug, label: name };
	}

	/** Resolve an improvement definition by slug — built-in first, then custom. */
	improvementDef(slug) {
		return IMPROVEMENT_DEFINITIONS.find(d => d.slug === slug)
			?? (this._flags.customImprovements ?? []).find(d => d.slug === slug)
			?? null;
	}

	/** Remove a custom improvement and clear its tracking state. */
	async removeCustomImprovement(slug) {
		const existing = this._flags.customImprovements ?? [];
		const next = existing.filter(d => d.slug !== slug);
		if (next.length === existing.length) return false;
		const improvements = { ...(this._flags.improvements ?? {}) };
		delete improvements[slug];
		await this.setFlags({ customImprovements: next, improvements });
		return true;
	}

	/** Named assets that are currently on hand (have a name and are not out on requisition). */
	getAvailableAssets() {
		const assets = this._flags.assets ?? STEADING_DEFAULTS.assets;
		return assets
			.map((asset, index) => ({ ...asset, index }))
			.filter(asset => asset.name && !asset.takenBy);
	}

	/**
	 * Mark an asset as requisitioned (taken out on an expedition): uncheck it and
	 * record who took it. Returns false if the index is out of range.
	 * @param {number} index
	 * @param {{name: string, id: string}} takenBy
	 */
	async setAssetTaken(index, takenBy) {
		const assets = foundry.utils.deepClone(this._flags.assets ?? STEADING_DEFAULTS.assets);
		if (!assets[index]?.name) return false;
		assets[index] = { ...assets[index], checked: false, takenBy };
		await this.setFlags({ assets });
		return true;
	}

	/** Return a requisitioned asset to the steading: re-check it and clear the taken-by note. */
	async returnAsset(index) {
		const assets = foundry.utils.deepClone(this._flags.assets ?? STEADING_DEFAULTS.assets);
		if (!assets[index]) return false;
		const { takenBy, ...rest } = assets[index];
		assets[index] = { ...rest, checked: true };
		await this.setFlags({ assets });
		return true;
	}

	async buildSnapshot() {
		const f = this._flags;
		const storedImps = f.improvements ?? {};

		const allActors = (typeof game !== "undefined" && game?.actors) ? game.actors : { filter: () => [], get: () => null };
		const allCharacters = allActors.filter(a => a.type === "character");

		const rawResidents = f.residents ?? STEADING_DEFAULTS.residents;
		const residents = rawResidents.map(r => {
			const resolvedOccupation = r.occupation
				|| (r.name
					? (allCharacters.find(a => a.name?.toLowerCase() === r.name.toLowerCase())
						?.system?.playbook?.name ?? "")
					: "");
			return { ...r, notes: r.notes ?? r.etc ?? "", resolvedOccupation };
		});

		const rawNeighbors = f.neighbors ?? STEADING_DEFAULTS.neighbors;
		const neighbors = rawNeighbors.map(n => ({ home: "", ...n, notes: n.notes ?? n.etc ?? "" }));

		const rawPlayers = f.players ?? STEADING_DEFAULTS.players;
		const players = rawPlayers.map(p => {
			// Resolve the live character so we can surface their playbook — by stored
			// id first, then name (drag-added players carry an id; older ones may not).
			const actor = (p.id ? allActors.get(p.id) : null)
				|| (p.name ? allCharacters.find(a => a.name?.toLowerCase() === p.name.toLowerCase()) : null)
				|| null;
			// A playbook isn't an occupation — players may hold any job — so the
			// Occupation column shows only an explicit occupation; the playbook name
			// surfaces on the portrait's hover tooltip instead (see the neighbors tab).
			const playbookName = actor?.system?.playbook?.name ?? "";
			const resolvedOccupation = p.occupation || "";
			return { traits: "", relations: "", ...p, notes: p.notes ?? p.etc ?? "", resolvedOccupation, playbookName };
		});

		const mapImprovement = (def, custom) => {
			const stored = storedImps[def.slug] ?? {};
			let idx = 0;
			const sections = def.sections.map(section => ({
				heading: section.heading,
				items: section.items.map(label => {
					const item = { label, index: idx, checked: (stored.r ?? [])[idx] ?? false };
					idx++;
					return item;
				}),
			}));
			const completed = stored.completed ?? false;
			const earned = completed || (stored.r ?? []).some(Boolean);
			// An improvement can only be marked complete once its requirements are
			// met; an already-complete one stays toggleable so it can be undone.
			const requirementsMet = improvementRequirementsMet(def, stored.r ?? []);
			return {
				slug: def.slug,
				label: def.label,
				flavor: def.flavor,
				completed,
				earned,
				requirementsMet,
				completeLocked: !requirementsMet && !completed,
				sections,
				effect: def.effect,
				custom: !!custom,
			};
		};
		// Built-in improvements first, then any journal-sourced custom ones (dropped
		// onto the sheet); both share the same tracking store keyed by slug.
		const improvements = [
			...IMPROVEMENT_DEFINITIONS.map(def => mapImprovement(def, false)),
			...(f.customImprovements ?? []).map(def => mapImprovement(def, true)),
		];

		return {
			system: {
				stats: {
					fortunes: { value: this.getSystemValue("stats.fortunes.value", SYSTEM_DEFAULTS.stats.fortunes.value) },
					defenses: { value: this.getSystemValue("stats.defenses.value", SYSTEM_DEFAULTS.stats.defenses.value) },
				},
				attributes: {
					population: { value: this.getSystemValue("attributes.population.value", SYSTEM_DEFAULTS.attributes.population.value) },
					prosperity: { value: this.getSystemValue("attributes.prosperity.value", SYSTEM_DEFAULTS.attributes.prosperity.value) },
					surplus: { value: this.getSystemValue("attributes.surplus.value", SYSTEM_DEFAULTS.attributes.surplus.value) },
					debilities: {
						options: {
							diminished: { value: this.getSystemValue("attributes.debilities.options.diminished.value", false) },
							lacking: { value: this.getSystemValue("attributes.debilities.options.lacking.value", false) },
							malcontent: { value: this.getSystemValue("attributes.debilities.options.malcontent.value", false) },
						},
					},
				},
			},
			resources:      f.resources      ?? STEADING_DEFAULTS.resources,
			fortifications: f.fortifications ?? STEADING_DEFAULTS.fortifications,
			assets:         f.assets         ?? STEADING_DEFAULTS.assets,
		residents,
			neighbors,
			players,
			// Suggestion pools for the inline combo fields (occupation / traits /
			// home) on the Residents / Neighbors / Players tables — same source as
			// the Add Steading Member dialog.
			suggestions: { occupations: OCCUPATIONS, traits: TRAITS, homes: HOMES },
			places:         f.places         ?? STEADING_DEFAULTS.places,
			notes:          f.notes          ?? STEADING_DEFAULTS.notes,
			size:           f.size           ?? STEADING_DEFAULTS.size,
			silver:         f.silver         ?? STEADING_DEFAULTS.silver,
			gold:           f.gold           ?? STEADING_DEFAULTS.gold,
			improvements,
		};
	}
}
