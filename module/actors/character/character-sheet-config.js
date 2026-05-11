export function characterSheetConfig() {
	return {
		stats: {
			str: {label: game.i18n.localize("stonetop.character.stats.strength"), value: 0},
			dex: {label: game.i18n.localize("stonetop.character.stats.dexterity"), value: 0},
			int: {label: game.i18n.localize("stonetop.character.stats.intelligence"), value: 0},
			wis: {label: game.i18n.localize("stonetop.character.stats.wisdom"), value: 0},
			con: {label: game.i18n.localize("stonetop.character.stats.constitution"), value: 0},
			cha: {label: game.i18n.localize("stonetop.character.stats.charisma"), value: 0},
		},
		moveTypes: {
			background: {label: game.i18n.localize("stonetop.character.moveTypes.background"), moves: []},
			basic: {label: "Basic Moves", creation: true, moves: []},
			playbook: {label: "Playbook Moves", playbook: true, moves: []},
			special: {label: "Special Moves", creation: true, moves: []},
			follower: {label: "Follower Moves", creation: true, moves: []},
			expedition: {label: "Expedition Moves", creation: true, moves: []},
			homefront: {label: "Homefront Moves", creation: true, moves: []},
		},
		attributes: {
			// -- TOP -------------------------------------------------------
			xp: {
				position: "Top",
				type: "Xp",
				label: game.i18n.localize("stonetop.character.attributes.xp"),
				max: 20,
				steps: Array.from({length: 20}, () => false),
			},
			level: {
				position: "Top",
				type: "Number",
				label: game.i18n.localize("stonetop.character.attributes.level"),
				value: 1,
			},
			stock: {
				position: "Top",
				type: "Clock",
				label: game.i18n.localize("stonetop.character.attributes.stock"),
				value: 0,
				max: 3,
				steps: Array.from({length: 3}, () => false),
				playbook: "the-blessed",
			},
			favor: {
				position: "Top",
				type: "Resource",
				label: game.i18n.localize("stonetop.character.attributes.favor"),
				playbook: "the-judge",
				value: 0,
				max: 4,
			},
			// -- LEFT ------------------------------------------------------
			debilities: {
				label: "Debilities",
				type: "LabeledCheckboxes",
				condition: true,
				options: {
					weakened: {label: "Weakened", value: false, stat: ["str", "dex"]},
					dazed: {label: "Dazed", value: false, stat: ["int", "wis"]},
					miserable: {label: "Miserable", value: false, stat: ["con", "cha"]},
				},
			},
			omen: {
				position: "Left",
				type: "Clock",
				label: game.i18n.localize("stonetop.character.attributes.omen"),
				playbook: "the-would-be-hero",
				value: 0,
				max: 3,
				steps: [false, false, false],
			},
			resolve: {
				position: "Left",
				type: "Clock",
				label: game.i18n.localize("stonetop.character.attributes.resolve"),
				playbook: "the-would-be-hero",
				default: 0,
				max: 2,
				steps: [false, false],
			},
			hp: {
				position: "Left",
				type: "Resource",
				label: "HP",
				value: 16,
				max: 16,
				min: 0,
			},
			armour: {
				type: "Number",
				label: "Armour",
				position: "Left",
				value: 0,
			},
			damage: {
				position: "Left",
				type: "Roll",
				label: "Damage",
				description: "The damage your character deals.",
				value: "d4",
			},
			load: {
				position: "Left",
				type: "ListOne",
				label: "Load",
				options: [{label: "Light", value: 3}, {label: "Normal", value: 6}, {label: "Heavy", value: 9}],
			},
		},
		equipmentTypes: {
			special: {label: "Special Possessions", items: []},
			gear: {label: "Gear", items: []},
		},
	};
}

export function buildCreation(flags, saved = {}) {
	if (!flags) return null;
	const hasData = flags.backgrounds?.length || flags.instincts?.length || flags.appearance?.length;
	if (!hasData) return null;
	return {
		backgrounds: (flags.backgrounds ?? []).map(b => {
			const selected = saved.background === b.slug;
			const result = { ...b, selected };
			if (b.choices) {
				const savedChoices = saved.backgroundChoices ?? {};
				result.choices = {
					label: b.choices.label,
					countLabel: b.choices.count.join(" or "),
					options: b.choices.options.map(o => ({
						...o,
						selected: Boolean(savedChoices[o.slug]),
					})),
				};
			}
			return result;
		}),
		instincts: (flags.instincts ?? []).map(v => ({
			word: v.word,
			description: v.description,
		})),
		appearance: (flags.appearance ?? []).map((line, i) => ({
			lineIdx: i,
			options: line.map(v => ({
				value: v,
				selected: (saved.appearance ?? {})[i] === v,
			})),
		})),
	};
}
