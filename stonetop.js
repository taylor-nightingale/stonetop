import { registerSettings } from "./module/settings.js";
import { createStonetopActorClass } from "./module/actors/stonetop-actor.js";
import { createStonetopItemClass } from "./module/item/item.js";
import { createStonetopCharacterSheetClass } from "./module/actors/character/character-sheet-app.js";
import { onPbtaSheetConfig } from "./module/hooks/pbta-sheet-config.js";
import { onReady } from "./module/hooks/ready.js";
import { onRenderActorSheet } from "./module/hooks/render-actor-sheet.js";
import { onRenderPause } from "./module/hooks/render-pause.js";
import { info } from "./module/utils/logger.js";

// -- INIT ------------------------------------------------------
// Fires before the world loads. Document classes and settings must
// be registered here so they're available before any documents load.
Hooks.once("init", () => {
	info("Initializing");

	registerSettings();

	CONFIG.Actor.documentClass = createStonetopActorClass(CONFIG.Actor.documentClass);
	CONFIG.Item.documentClass = createStonetopItemClass(CONFIG.Item.documentClass);

	const StonetopCharacterSheet = createStonetopCharacterSheetClass(game.pbta.applications.actor.PbtaActorSheet);
	Actors.registerSheet("stonetop", StonetopCharacterSheet, {
		types: ["character"],
		makeDefault: true,
		label: "Stonetop Character Sheet",
	});

	loadTemplates({
		"stonetop.tab-details": "modules/stonetop/templates/actor/partials/tab-details.hbs",
		"stonetop.tab-moves":   "modules/stonetop/templates/actor/partials/tab-moves.hbs",
	});
});

// -- RENDER PAUSE ----------------------------------------------
// Fires when the game is paused
Hooks.on("renderPause", onRenderPause);

// -- PBTA SHEET CONFIG -----------------------------------------
// Fires after init, before ready. pbta listens for this hook
// to allow modules to override its sheet configuration.
Hooks.once("pbtaSheetConfig", onPbtaSheetConfig);

// -- READY -----------------------------------------------------
// Fires when the world is fully loaded and all documents exist.
Hooks.once("ready", onReady);

// -- RENDER ACTOR SHEET ----------------------------------------
// Fires every time any actor sheet renders.
Hooks.on("renderActorSheet", onRenderActorSheet);
