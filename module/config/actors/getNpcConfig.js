export function getNpcConfig() {
	return {
		attributes: {
			hp: {
				type: "Resource",
				label: game.i18n.localize("stonetop.npc.hitPoints"),
				position: "left",
			},
			armor: {
				type: "Resource",
				label: game.i18n.localize("stonetop.npc.armor"),
				position: "left",
			},
			instinct: {
				type: "Text",
				label: game.i18n.localize("stonetop.npc.instinct"),
				position: "top",
			},
		}
	}
}

