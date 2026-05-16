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
			// -- TOP (left-to-right order) ---------------------------------
			damage: {
				position: "Top",
				type: "Roll",
				label: game.i18n.localize("stonetop.character.attributes.damage"),
				value: "d4",
			},
			hp: {
				position: "Top",
				type: "Resource",
				label: "HP",
				value: 16,
				max: 16,
				min: 0,
			},
			armour: {
				position: "Top",
				type: "Number",
				label: game.i18n.localize("stonetop.character.attributes.armour"),
				value: 0,
			},
			xp: {
				position: "Top",
				type: "Resource",
				label: game.i18n.localize("stonetop.character.attributes.xp"),
				value: 0,
				max: 8,
			},
			level: {
				position: "Top",
				type: "Number",
				label: game.i18n.localize("stonetop.character.attributes.level"),
				value: 1,
			},
			// -- NO POSITION (rendered manually in template) ---------------
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
		},
		equipmentTypes: {
		},
	};
}
