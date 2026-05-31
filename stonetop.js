import { registerSettings } from "./module/settings.js";
import { createStonetopActorClass } from "./module/actors/StonetopActor.js";
import { createStonetopItemClass } from "./module/item/StonetopItem.js";
import { createStonetopCharacterSheetClass } from "./module/actors/character/StonetopCharacterSheet.js";
import { createStonetopSteadingSheetClass } from "./module/actors/steading/StonetopSteadingSheet.js";
import { onPbtaSheetConfig } from "./module/hooks/PbtaSheetConfig.js";
import { onReady } from "./module/hooks/Ready.js";
import { onRenderActorSheet } from "./module/hooks/RenderActorSheet.js";
import { onRenderPause } from "./module/hooks/RenderPause.js";
import { info } from "./module/utils/logger.js";

// -- INIT ------------------------------------------------------
// Fires before the world loads. Document classes and settings must
// be registered here so they're available before any documents load.
Hooks.once("init", () => {
	info("Initializing");

	registerSettings();

	Handlebars.registerHelper("resourceChecks", resource => {
		if (!resource) return [];
		const { current, max, labels } = resource;
		return Array.from({ length: max }, (_, i) => ({ checked: i < current, label: labels[i] || null }));
	});

	Handlebars.registerHelper("poolGroups", pool => {
		if (!pool) return [];
		const { current } = pool;
		return [
			Array.from({ length: 3 }, (_, i) => ({ checked: i < current, index: i })),
			Array.from({ length: 3 }, (_, i) => ({ checked: (i + 3) < current, index: i + 3 })),
			Array.from({ length: 3 }, (_, i) => ({ checked: (i + 6) < current, index: i + 6 })),
		];
	});

	Handlebars.registerHelper("times", n => Array.from({ length: n ?? 0 }, (_, i) => i));

	Handlebars.registerHelper("outfitSegments", items => {
		const segments = [];
		let current = null;
		for (const item of (items ?? [])) {
			if (!current || current.isGrid !== item.twoCol) {
				current = { isGrid: item.twoCol, items: [] };
				segments.push(current);
			}
			current.items.push(item);
		}
		return segments;
	});
	Handlebars.registerHelper("gt", (a, b) => a > b);
	Handlebars.registerHelper("eq", (a, b) => a === b);

	Handlebars.registerHelper("repeatChecks", move => {
		const sel = move?.selection;
		if (!sel || sel.max <= 1) return [];
		return Array.from({ length: sel.max }, (_, i) => ({
			checked:  i < sel.value,
			disabled: i < sel.value ? move.isStarting : (!move.selectable || i !== sel.value),
		}));
	});

	CONFIG.Actor.documentClass = createStonetopActorClass(CONFIG.Actor.documentClass);
	CONFIG.Item.documentClass = createStonetopItemClass(CONFIG.Item.documentClass);

	const StonetopCharacterSheet = createStonetopCharacterSheetClass(game.pbta.applications.actor.PbtaActorSheet);
	foundry.documents.collections.Actors.registerSheet("stonetop", StonetopCharacterSheet, {
		types: ["character"],
		makeDefault: true,
		label: "Stonetop Character Sheet",
	});

	const StonetopSteadingSheet = createStonetopSteadingSheetClass(foundry.appv1.sheets.ActorSheet);
	foundry.documents.collections.Actors.registerSheet("stonetop", StonetopSteadingSheet, {
		types: ["stonetop.steading"],
		makeDefault: true,
		label: "Stonetop Steading Sheet",
	});

	foundry.applications.handlebars.loadTemplates({
		"stonetop.tab-details":      "modules/stonetop/templates/actor/partials/tab-details.hbs",
		"stonetop.tab-moves":        "modules/stonetop/templates/actor/partials/tab-moves.hbs",
		"stonetop.tab-equipment":    "modules/stonetop/templates/actor/partials/tab-equipment.hbs",
		"stonetop.tab-arcana":       "modules/stonetop/templates/actor/partials/tab-arcana.hbs",
		"stonetop.arcanum-cards":    "modules/stonetop/templates/actor/partials/arcanum-cards.hbs",
		"stonetop.tab-followers":    "modules/stonetop/templates/actor/partials/tab-followers.hbs",
		"stonetop.follower-card":    "modules/stonetop/templates/actor/partials/follower-card.hbs",
		"stonetop.tab-post-death":   "modules/stonetop/templates/actor/partials/tab-post-death.hbs",
		"stonetop.move-group":       "modules/stonetop/templates/actor/partials/move-group.hbs",
		"stonetop.choice-row":       "modules/stonetop/templates/actor/partials/choice-row.hbs",
		"stonetop.choice-section":   "modules/stonetop/templates/actor/partials/lore-section.hbs",
		"stonetop.section-heading":  "modules/stonetop/templates/actor/partials/section-heading.hbs",
		"stonetop.resource-track":   "modules/stonetop/templates/actor/partials/resource-track.hbs",
		"stonetop.steading":         "modules/stonetop/templates/actor/steading.hbs",
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
