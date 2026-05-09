import { registerSettings } from "./module/settings.js";
import { createStonetopActorClass } from "./module/actor/actor.js";
import { createStonetopItemClass } from "./module/item/item.js";
import { createStonetopCharacterSheetClass } from "./module/sheets/stonetop-character-sheet.js";
import { StonetopSteadingSheet } from "./module/sheets/stonetop-steading-sheet.js";
import { onPbtaSheetConfig } from "./module/hooks/pbta-sheet-config.js";
import { onReady } from "./module/hooks/ready.js";
import { onRenderActorSheet } from "./module/hooks/render-actor-sheet.js";
import { onRenderPause } from "./module/hooks/render-pause.js";

// -- INIT ------------------------------------------------------
// Fires before the world loads.
Hooks.once("init", () => {
	console.log("Stonetop | Initializing");

	registerSettings();

	CONFIG.Actor.documentClass = createStonetopActorClass(CONFIG.Actor.documentClass);
	CONFIG.Item.documentClass = createStonetopItemClass(CONFIG.Item.documentClass);

	const BasePbtaSheet = Actors.registeredSheets
		.find(s => s.scope === "pbta" && s.types.includes("character"))?.cls
		?? foundry.appv1.sheets.ActorSheet;

	Actors.registerSheet("stonetop", createStonetopCharacterSheetClass(BasePbtaSheet), {
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
import { info } from "./module/utils/logger.js";


