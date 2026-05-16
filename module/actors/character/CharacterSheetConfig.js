export function characterSheetConfig() {
	return {
		stats: {
			str: {label: game.i18n.localize("stonetop.character.stats.strength"),     value: 0},
			dex: {label: game.i18n.localize("stonetop.character.stats.dexterity"),    value: 0},
			int: {label: game.i18n.localize("stonetop.character.stats.intelligence"), value: 0},
			wis: {label: game.i18n.localize("stonetop.character.stats.wisdom"),       value: 0},
			con: {label: game.i18n.localize("stonetop.character.stats.constitution"), value: 0},
			cha: {label: game.i18n.localize("stonetop.character.stats.charisma"),     value: 0},
		},
		moveTypes: {
			background: {label: game.i18n.localize("stonetop.character.moveTypes.background"), moves: []},
			basic: {label: "Basic Moves", creation: true, moves: []},
			playbook: {label: "Playbook Moves", playbook: true, moves: []},
			special: {label: "Special Moves", creation: true, moves: []},
			follower: {label: "Follower Moves", creation: true, moves: []},
			expedition: {label: "Expedition Moves", creation: true, moves: []},
			homefront: {label: "Homefront Moves", creation: true, moves: []},
			other: {label: game.i18n.localize("stonetop.character.moves.otherMoves"), creation: true, moves: []},
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
			// -- LEFT ------------------------------------------------------
			debilities: {
				label: "Debilities",
				type: "ListMany",
				condition: true,
				options: {
					weakened: {label: "Weakened", value: false, stat: ["str", "dex"]},
					dazed: {label: "Dazed", value: false, stat: ["int", "wis"]},
					miserable: {label: "Miserable", value: false, stat: ["con", "cha"]},
				},
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
		},
	};
}
