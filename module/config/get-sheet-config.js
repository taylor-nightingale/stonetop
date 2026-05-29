import {characterSheetConfig } from "../actors/character/CharacterSheetConfig.js";
import { getNpcConfig } from "./actors/getNpcConfig.js";
import { GetSteadingConfig } from "./actors/getSteadingConfig.js";

export function GetSheetConfig() {
	return {
		// -- ROLLING -------------------------------------------------
		rollFormula: "2d6",
		rollShifting: true,
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

		// -- ACTORS --------------------------------------------------
		actorTypes: {
			character: characterSheetConfig(),
			npc: getNpcConfig(),
			"stonetop.steading": GetSteadingConfig(),
		},
		moveTypes: {
			gm: "GM Moves",
		},
	};
}
