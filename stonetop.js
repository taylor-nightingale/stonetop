import { registerSettings } from "./src/settings.js";
import { createStonetopActorClass } from "./src/actors/StonetopActor.js";
import { createStonetopItemClass } from "./src/item/StonetopItem.js";
import { StonetopActorSheet } from "./src/actors/StonetopActorSheet.js";
import { createStonetopCharacterSheetClass } from "./src/actors/character/StonetopCharacterSheet.js";
import { createStonetopSteadingSheetClass } from "./src/actors/steading/StonetopSteadingSheet.js";
import { onReady } from "./src/hooks/Ready.js";
import { onRenderActorSheet } from "./src/hooks/RenderActorSheet.js";
import { onRenderPause } from "./src/hooks/RenderPause.js";
import { info } from "./src/utils/logger.js";

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

	const StonetopCharacterSheet = createStonetopCharacterSheetClass(StonetopActorSheet);
	foundry.documents.collections.Actors.registerSheet("stonetop", StonetopCharacterSheet, {
		types: ["character"],
		makeDefault: true,
		label: "Stonetop Character Sheet",
	});

	const StonetopSteadingSheet = createStonetopSteadingSheetClass(foundry.appv1.sheets.ActorSheet);
	foundry.documents.collections.Actors.registerSheet("stonetop", StonetopSteadingSheet, {
		types: ["steading"],
		makeDefault: true,
		label: "Stonetop Steading Sheet",
	});

	foundry.applications.handlebars.loadTemplates({
		"stonetop.actor-header":     "systems/stonetop/templates/actor/partials/actor-header.hbs",
		"stonetop.actor-stats":      "systems/stonetop/templates/actor/partials/actor-stats.hbs",
		"stonetop.actor-attributes": "systems/stonetop/templates/actor/partials/actor-attributes.hbs",
		"stonetop.tab-details":      "systems/stonetop/templates/actor/partials/tab-details.hbs",
		"stonetop.tab-moves":        "systems/stonetop/templates/actor/partials/tab-moves.hbs",
		"stonetop.tab-equipment":    "systems/stonetop/templates/actor/partials/tab-equipment.hbs",
		"stonetop.tab-arcana":       "systems/stonetop/templates/actor/partials/tab-arcana.hbs",
		"stonetop.arcanum-cards":    "systems/stonetop/templates/actor/partials/arcanum-cards.hbs",
		"stonetop.tab-followers":    "systems/stonetop/templates/actor/partials/tab-followers.hbs",
		"stonetop.follower-card":    "systems/stonetop/templates/actor/partials/follower-card.hbs",
		"stonetop.tab-post-death":   "systems/stonetop/templates/actor/partials/tab-post-death.hbs",
		"stonetop.move-group":       "systems/stonetop/templates/actor/partials/move-group.hbs",
		"stonetop.choice-row":       "systems/stonetop/templates/actor/partials/choice-row.hbs",
		"stonetop.choice-section":   "systems/stonetop/templates/actor/partials/lore-section.hbs",
		"stonetop.section-heading":  "systems/stonetop/templates/actor/partials/section-heading.hbs",
		"stonetop.resource-track":   "systems/stonetop/templates/actor/partials/resource-track.hbs",
		"stonetop.steading":         "systems/stonetop/templates/actor/steading.hbs",
	});
});

// -- RENDER PAUSE ----------------------------------------------
// Fires when the game is paused
Hooks.on("renderPause", onRenderPause);

// -- READY -----------------------------------------------------
// Fires when the world is fully loaded and all documents exist.
Hooks.once("ready", onReady);

// -- RENDER ACTOR SHEET ----------------------------------------
// Fires every time any actor sheet renders.
Hooks.on("renderActorSheet", onRenderActorSheet);
