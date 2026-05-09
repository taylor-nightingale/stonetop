import { registerSettings } from "./module/settings.js";
import { createStonetopActorClass } from "./module/actor/actor.js";
import { StonetopItem } from "./module/item/item.js";
import { StonetopCharacterSheet } from "./sheets/stonetop-character-sheet.js";
import { StonetopSteadingSheet } from "./sheets/stonetop-steading-sheet.js";
import { onPbtaSheetConfig } from "./hooks/pbta-sheet-config.js";
import { onReady } from "./hooks/ready.js";
import { onRenderActorSheet } from "./hooks/render-actor-sheet.js";
import { onRenderPause } from "./hooks/render-pause.js";

// -- INIT ------------------------------------------------------
// Fires before the world loads.
Hooks.once("init", () => {
	console.log("Stonetop | Initializing");

	registerSettings();

	CONFIG.Actor.documentClass = createStonetopActorClass(CONFIG.Actor.documentClass);
	CONFIG.Item.documentClass = StonetopItem;

	Actors.registerSheet("stonetop", StonetopCharacterSheet, {
		types: ["character"],
		makeDefault: true,
		label: "Stonetop Character Sheet"
	});

	Actors.registerSheet("stonetop", StonetopSteadingSheet, {
		types: ["steading"],
		makeDefault: true,
		label: "Stonetop Steading Sheet"
	});

	loadTemplates([
		"modules/stonetop/templates/actor/character-sheet.hbs",
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
// Used for lightweight UI additions that don't need
// a full sheet subclass
Hooks.on("renderActorSheet", onRenderActorSheet);

















// old
import { info } from "./utils/logger.js";


