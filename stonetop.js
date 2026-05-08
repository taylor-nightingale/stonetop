import { info } from "./scripts/logger.js";
import { CharacterType } from "./scripts/actor/character.js";

Hooks.on("renderPause", () => {
	info("Overriding the default pause spinner.");
	const pause = document.getElementById("pause");
	pause.lastElementChild.innerText = "Time Frozen";
	pause.firstElementChild.src = "/modules/stonetop/assets/graphics/pause.png";
});

Hooks.once("pbtaSheetConfig", () => {
	if (!game.user.isGM) return;

	// Disable the sheet config form.
	info("Setting up Stonetop sheet config.");
	game.settings.set("pbta", "sheetConfigOverride", true);

	// Define custom tags.
	// game.pbta.tagConfigOverride = {
	// 	// Tags available to any actor and item
	// 	general: '[{"value":"fire"}]',
	// 	actor: {
	// 		// Tags available to all actors
	// 		all: '[{"value":"person"}]',
	// 		// Tags available to a specific actor type set up on game.pbta.sheetConfig.actorTypes (e.g. "character", "npc")
	// 		character: '[{"value":"mook"}]',
	// 	},
	// 	item: {
	// 		// Tags available to all actors
	// 		all: '[{"value":"consumable"}]',
	// 		// Tags available to a specific item type (e.g. "equipment", "move")
	// 		move: '[{"value":"sword"}]',
	// 	},
	// };

	game.pbta.sheetConfig = {
		rollFormula: "2d6",
		statToggle: {
			label: "Debility",
			modifier: 'dis',
		},
		rollResults: {
			failure: {
				start: null,
				end: 6,
				label: game.i18n.localize("stonetop.rollResults.miss"),
			},
			partial: {
				start: 7,
				end: 9,
				label: game.i18n.localize("stonetop.rollResults.weakHit"),
			},
			success: {
				start: 10,
				end: 12,
				label: game.i18n.localize("stonetop.rollResults.strongHit"),
			},
		},
		actorTypes: {
			character: CharacterType,
			npc: {
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
				},
				moveTypes: {
					gm: "GM Moves",
				},
			},
		},
	}
});
