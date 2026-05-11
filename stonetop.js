import { registerSettings } from "./module/settings.js";
import { createStonetopActorClass } from "./module/actors/stonetop-actor.js";
import { createStonetopItemClass } from "./module/item/item.js";
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

	loadTemplates([
		"modules/stonetop/templates/actor/partials/stats.hbs",
		"modules/stonetop/templates/actor/partials/moves.hbs",
		"modules/stonetop/templates/actor/partials/resources.hbs",
		"modules/stonetop/templates/actor/partials/debilities.hbs",
		"modules/stonetop/templates/actor/partials/playbook-info.hbs",
		"modules/stonetop/templates/item/move-sheet.hbs",
		"modules/stonetop/templates/item/playbook-sheet.hbs",
	]);
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
