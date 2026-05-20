export class FakePlaybookRepository {
	constructor(playbook = null) {
		this._playbooks = {};
		if (playbook !== null) {
			this.add(playbook);
		}
	}

	async findBySlug(slug) {
		return this._playbooks[slug];
	}

	add(playbook) {
		this._playbooks[playbook.slug] = playbook;
	}
}

export const BLESSED_PLAYBOOK = {
	"slug": "the-blessed",
	"name": "The Blessed",
	"hp": 18,
	"damage": "d6",
	"moves": {
		"startingMovesNote": "You start with Spirit Tongue, Call the Spirits, 1 from your Background, and 1 of your choice."
	},
	"backgrounds": [
		{
			"slug": "initiate",
			"label": "Initiate",
			"description": "<p>Stonetop has long been home to a sacred order, keepers of the old ways and speakers for Danu. You are one such initiate, the most gifted in generations. You gain the <strong>Rites of the Land</strong> move.</p>",
			"moves": [
				"Rites of the Land"
			],
			"choices": {
				"label": "There are other initiates in Stonetop, serving the goddess and the village. They aid you as followers— see the Initiates of Danu insert. Who are they?",
				"count": [
					2,
					3
				],
				"options": [
					{
						"slug": "enfys",
						"label": "Enfys, your acolyte, beloved by birds"
					},
					{
						"slug": "afon",
						"label": "Afon, strange and Fae-touched"
					},
					{
						"slug": "gwendyl",
						"label": "Gwendyl, your mentor, a talented healer"
					},
					{
						"slug": "olwin",
						"label": "Olwin, your anointed lover, seer of fates"
					},
					{
						"slug": "seren",
						"label": "Seren the Eldest, wise and hard as winter"
					}
				]
			}
		},
		{
			"slug": "raised-by-wolves",
			"label": "Raised by Wolves",
			"moves": [
				"Trackless Step"
			],
			"description": "<p>Maybe not by wolves, but you grew up in the wild. Beasts of land and air were your siblings. The sighing wind taught you language. The trees and rocks were your home. Were you one of the Forest Folk? Abandoned or orphaned? Lured into the Wood?</p><p>Regardless, you get the <strong>Trackless Step</strong> move. Also, when you <em><strong>Forage</strong></em>, you have advantage.</p><p>For some reason, you've made yourself known to Stonetop and perhaps you even call it home. But the ways of the humans are still strange to you. Once per session, when <em><strong>your wild ways offend or alienate you from someone</strong></em>, mark XP.</p>"
		},
		{
			"slug": "vessel",
			"label": "Vessel",
			"moves": [
				"Danu's Grasp"
			],
			"description": "<p>A seed of Danu's power has taken root in your soul. Perhaps it has always been there and only recently sprouted. Or maybe it was planted in you during some portentous event. Take the <strong>Danu's Grasp</strong> move. When you <strong><em>would spend 1 Stock from your sacred pouch</strong></em>, you may choose to lose 2d4 HP instead.</p>"
		}
	],
	"instincts": [
		{
			"word": "Delight",
			"description": "To find beauty, in even the ugliest things."
		},
		{
			"word": "Detachment",
			"description": "To remain unmoved, to be cold as winter."
		},
		{
			"word": "Nurture",
			"description": "To help others grow, learn, or improve."
		},
		{
			"word": "Preservation",
			"description": "To protect the natural world."
		},
		{
			"word": "Reverence",
			"description": "To honor the spirits and give them their due."
		}
	],
	"appearance": [
		[
			"fresh-faced",
			"hale & hearty",
			"gray & wizened"
		],
		[
			"imperious voice",
			"raspy voice",
			"soothing voice"
		],
		[
			"curvy",
			"strapping",
			"rail-thin",
			"solid",
			"willowy"
		],
		[
			"ceremonial robes",
			"furs, leather",
			"work clothes"
		]
	],
	"origin": [
		{
			"region": "Stonetop",
			"names": [
				"Arwel",
				"Blodwen",
				"Brynmor",
				"Celyn",
				"Fflur",
				"Gwynn",
				"Tegwen",
				"Winned"
			]
		},
		{
			"region": "Barrier Pass",
			"names": [
				"Alagh",
				"Bora",
				"Chambui",
				"Enebish",
				"Jalakai",
				"Kamala",
				"Sechen",
				"Todogen"
			]
		},
		{
			"region": "The Steplands",
			"names": [
				"Bejn",
				"Decla",
				"Franza",
				"Irv",
				"Ivet",
				"Jak",
				"Sibl",
				"Yez"
			]
		},
		{
			"region": "The Wild",
			"names": [
				"Autumn",
				"Badger",
				"Big",
				"Black",
				"Bloody",
				"Brave",
				"Crow",
				"Cub",
				"Dark",
				"Doe",
				"Fang",
				"Fierce",
				"Flower",
				"Gentle",
				"Green",
				"Grim",
				"Hart",
				"Leaf",
				"Little",
				"Lonely",
				"Old",
				"Owl",
				"Pale",
				"Pup",
				"Quiet",
				"Rain",
				"Red",
				"Sharp",
				"Snake",
				"Snow",
				"Spring",
				"Summer",
				"Tall",
				"Tree",
				"Yellow",
				"White",
				"Wind",
				"Winter",
				"Wolf",
				"Whisper"
			]
		}
	],
	"specialPossessions": {
		"pickNote": "Pick 2, in addition to your sacred pouch",
		"pickCount": 2,
		"preselected": [
			"sacred-pouch"
		],
		"options": [
			{
				"slug": "sacred-pouch",
				"label": "Sacred pouch (<em>magical</em>)",
				"description": "<p>Doesn't take up space in your inventory. It can hold up to 3 Stock (sacred herbs, powders, stones, pigments, chalks, clay, and so forth). Each time you gain an even-numbered level, your pouch can hold +1 Stock. When anyone but you looks inside your sacred pouch and touches the materials therein, the Stock is ruined.</p><p>When you have a few days of downtime in familiar terrain, you may replenish your Stock.</p><p>When you Forage, you can produce Stock instead of provisions.</p>",
				"usesBonus": {
					"evenLevelBonus": 1,
					"moveBonus": [
						{
							"moveName": "Big Magic",
							"perInstance": 2
						}
					]
				},
				"choiceGroups": [
					{
						"heading": "Your sacred pouch is...",
						"note": "choose 1 on each line",
						"subgroups": [
							{
								"pickCount": 1,
								"options": [
									{
										"slug": "origin-heirloom",
										"label": "an heirloom made just for you"
									},
									{
										"slug": "origin-own-work",
										"label": "your own work"
									}
								]
							},
							{
								"pickCount": 1,
								"options": [
									{
										"slug": "material-fur",
										"label": "fur"
									},
									{
										"slug": "material-drakescale",
										"label": "drakescale"
									},
									{
										"slug": "material-leather",
										"label": "leather"
									},
									{
										"slug": "material-woven",
										"label": "woven"
									},
									{
										"slug": "material-demonflesh",
										"label": "demonflesh"
									}
								]
							},
							{
								"pickCount": 1,
								"options": [
									{
										"slug": "decor-unadorned",
										"label": "unadorned"
									},
									{
										"slug": "decor-beadwork",
										"label": "beadwork"
									},
									{
										"slug": "decor-rich-dyes",
										"label": "rich dyes"
									},
									{
										"slug": "decor-runes",
										"label": "runes"
									}
								]
							}
						]
					},
					{
						"heading": "What remarkable trait does it possess?",
						"note": "choose 1",
						"subgroups": [
							{
								"multiSelect": true,
								"options": [
									{
										"slug": "trait-indestructible",
										"label": "It cannot be cut, torn, or burned by any natural means."
									},
									{
										"slug": "trait-unnoticed",
										"label": "Unless someone is specifically searching for your pouch, they will ignore its presence."
									},
									{
										"slug": "trait-sealed",
										"label": "So long as the pouch is sealed, nothing within can be detected or found by magic, nor can anything within escape or affect the outside world."
									},
									{
										"slug": "trait-unclean",
										"label": "Unnatural and unclean creatures cannot bear to touch it."
									}
								]
							}
						]
					}
				],
				"resource": {
					"max": 3,
					"title": "Stock",
					"labels": []
				}
			},
			{
				"slug": "apiary",
				"label": "Apiary",
				"description": "beeswax, candles (<em>close, area</em>, lasts ~1 hr), honey, ◇ bee smokers, ◇ hat &amp; veils, etc."
			},
			{
				"slug": "collected-offerings",
				"label": "Collected offerings",
				"description": "(○○○ uses) Expend a use to produce something valuable to a spirit of the wild. Restore 1 use each season.",
				"resource": {
					"max": 3,
					"title": null,
					"labels": []
				}
			},
			{
				"slug": "goat-herd",
				"label": "Goat herd",
				"description": "milk, cheese, pelts, meat, blood, horn, wool, etc. Each season, 1 in 4 chance of having a bezoar (swallow it to cure poison)."
			},
			{
				"slug": "herb-garden",
				"label": "Herb garden",
				"description": "shears, mortars &amp; pestles, herbs, seeds, remedies, mild poisons, ◇ spades, etc. Each spring, d4 uses of bendis root (<em>reach, area</em>, burns ~1 hr, fumes repel perversions of nature)."
			},
			{
				"slug": "mastiffs",
				"label": "Mastiffs",
				"description": "2-3 followers (<em>alert, keen-nosed, fierce, overprotective</em>); HP 6; Damage d6 (<em>hand, grabby</em>); Instinct: to bark &amp; threaten; Cost: affection."
			}
		]
	},
	"statsNote": "Assign these scores to your stats: +2, +1, +1, +0, +0, -1"
};

export const HEAVY_PLAYBOOK = {
	"hp": 20,
	"damage": "d10",
	"moves": {
		"startingMovesNote": "You start with Dangerous, Hard to Kill, and either Armored OR Uncanny Reflexes."
	},
	"backgrounds": [
		{
			"slug": "sheriff",
			"label": "Sheriff",
			"description": "<p>You keep order in Stonetop and protect it from outside threats. It might not be anything official, but everyone knows you've got a cool head and the weight to back up your words.</p><p>When you <strong><em>bark an order or warning</em></strong>, roll +CHA: <strong>on a 7+</strong>, they must choose 1: <ul><li>do what you say</li><li>dig in/take cover/flee</li> or <li>attack you</li></ul> <strong><em>On a 10+</em></strong>, you can sense which one they're about to do and act first if you like; gain advantage if you do.</p>"
		},
		{
			"slug": "blood-soaked-past",
			"label": "Blood-Soaked Past",
			"description": "<p>You left behind a life of violence and a name mothers used to scare their children. For whatever reason, the people of Stonetop took you (back?) in and treat you like one of their own.</p><p>When you <strong><em>Persuade using violence or threats against someone who knows your black reputation</em></strong>, you can roll +STR instead of +CHA. Also, if you take the <strong>Formidable</strong> move, you can choose to roll +CON instead of +CHA.</p><p>When you <strong><em>fight to kill without mercy or hesitation</em></strong>, you deal +1d4 damage.</p>"
		},
		{
			"slug": "storm-marked",
			"label": "Storm-Marked",
			"description": "<p>You've been touched by Tor (Rain-maker, Thunderhead, Slayer-of-Beasts!) and bear runic markings similar to those etched into the Stone. When did the marks manifest? Are they a symbol of your strength, speed, and courage? Or their source?</p><p>You start with the <strong>Storm Markings</strong> major arcanum. Mark one of the boxes on the front of the Storm Markings sheet, and describe here the time you were struck by lightning and walked away unharmed.</p>"
		}
	],
	"instincts": [
		{
			"word": "Peace",
			"description": "To avoid (further) bloodshed or violence."
		},
		{
			"word": "Pride",
			"description": "To maintain your dignity, to demand respect."
		},
		{
			"word": "Recklessness",
			"description": "To act without thought to the consequences."
		},
		{
			"word": "Trouble",
			"description": "To stick your nose in where it's unwelcome."
		},
		{
			"word": "Violence",
			"description": "To solve problems by force."
		}
	],
	"appearance": [
		[
			"young & brash",
			"in my prime",
			"old & leathery"
		],
		[
			"gravelly voice",
			"hearty voice",
			"soft-spoken"
		],
		[
			"giant frame",
			"just ripped",
			"stocky",
			"wiry"
		],
		[
			"distinctive scars",
			"off-broken nose",
			"missing bits"
		]
	],
	"origin": [
		{
			"region": "Stonetop",
			"names": [
				"Aerona",
				"Arthfael",
				"Cadmor",
				"Esyllt",
				"Pedr",
				"Rhonwen",
				"Terrwen",
				"Trystan"
			]
		},
		{
			"region": "Gordin's Delve",
			"names": []
		},
		{
			"region": "Marshedge",
			"names": [
				"Aengus",
				"Bairbre",
				"Bronach",
				"Flann",
				"Laughn",
				"Muirdoc",
				"Quinn",
				"Treasa"
			]
		},
		{
			"region": "The Steplands (Hillfolk)",
			"names": [
				"Andr",
				"Gabel",
				"Kaetl",
				"Mael",
				"Maela",
				"Par",
				"Ral",
				"Umbert"
			]
		},
		{
			"region": "The Manmarch",
			"names": [
				"Bathhilde",
				"Clothar",
				"Ganter",
				"Hiltrude",
				"Ludig",
				"Luise",
				"Modd",
				"Wiland"
			]
		},
		{
			"region": "Lygos or some other point south",
			"names": [
				"Arihl",
				"Akios",
				"Bhadur",
				"Seble",
				"Shahnaz",
				"Shay",
				"Tisi",
				"Zubin"
			]
		}
	],
	"specialPossessions": {
		"pickNote": "Pick 2",
		"pickCount": 2,
		"preselected": [],
		"options": [
			{
				"slug": "distillery",
				"label": "Distillery",
				"description": "○○ uses: skins of fine whisky (grants advantage to Persuade), copper tubes, malt, firkins, stills, barrels, etc.",
				"resource": {
					"max": 2,
					"title": null,
					"labels": []
				}
			},
			{
				"slug": "chirurgeons-tools",
				"label": "Chirurgeon's tools",
				"description": "catgut, straps, bandages, tubes, poultices, willow bark, ◇ bonesaws, etc."
			},
			{
				"slug": "husbandry-tools",
				"label": "Husbandry tools",
				"description": "brushes, muzzles, collars, feed, ◇ whips, ◇ bridles, etc. Gain advantage to Persuade domestic beasts (livestock, dogs, etc.)."
			},
			{
				"slug": "smithy",
				"label": "Smithy",
				"description": "(or access to it): iron goods, ingots, thick gloves, ◇ tongs, ◇ bellows, an anvil, etc."
			},
			{
				"slug": "stoneworkers-tools",
				"label": "Stoneworker's tools",
				"description": "chisels, drills, ◇ prybars, ◇ spikes, ◇ block &amp; tackles, wheelbarrow, etc."
			},
			{
				"slug": "weapons-of-war",
				"label": "Weapons of war",
				"description": "",
				"choices": {
					"pickCount": 3,
					"options": [
						{
							"slug": "sword",
							"label": "◇ Sword, iron (<em>close</em>, +1 damage)"
						},
						{
							"slug": "battleaxe",
							"label": "◇ Battleaxe, iron (<em>close, messy</em>)"
						},
						{
							"slug": "warhammer",
							"label": "◇ Warhammer, iron (<em>close</em>, 2 piercing)"
						},
						{
							"slug": "mace-or-flail",
							"label": "◇ Mace or flail, iron (<em>close, forceful</em>)"
						},
						{
							"slug": "crossbow",
							"label": "◇ Crossbow (<em>far</em>, +1 damage, <em>reload</em>, x piercing)",
							"resource": {
								"max": 2,
								"title": null,
								"labels": []
							}
						}
					]
				}
			}
		]
	},
	"statsNote": "Assign these scores to your stats: +2, +1, +1, +0, +0, -1"
};
