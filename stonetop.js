import { registerSettings } from "./src/settings.js";
import { createStonetopActorClass } from "./src/actors/StonetopActor.js";
import { createStonetopItemClass } from "./src/item/StonetopItem.js";
import { StonetopActorSheet } from "./src/actors/StonetopActorSheet.js";
import { createStonetopCharacterSheetClass } from "./src/actors/character/StonetopCharacterSheet.js";
import { createStonetopSteadingSheetClass } from "./src/actors/steading/StonetopSteadingSheet.js";
import { createStonetopNpcSheetClass } from "./src/actors/npc/StonetopNpcSheet.js";
import { createStonetopMoveSheetClass } from "./src/item/StonetopMoveSheet.js";
import { onReady } from "./src/hooks/Ready.js";
import { onRenderActorSheet } from "./src/hooks/RenderActorSheet.js";
import { onRenderPause } from "./src/hooks/RenderPause.js";
import { info } from "./src/utils/logger.js";
import { CharacterData } from "./src/data/CharacterData.js";
import { NpcData } from "./src/data/NpcData.js";
import { SteadingData } from "./src/data/SteadingData.js";
import { MoveData }        from "./src/data/MoveData.js";
import { ArcanumData }     from "./src/data/ArcanumData.js";
import { PlaybookData }    from "./src/data/PlaybookData.js";
import { InsertData }      from "./src/data/InsertData.js";
import { ImprovementData } from "./src/data/ImprovementData.js";
import { NpcItemData }     from "./src/data/NpcItemData.js";
import { OutfitItemData }  from "./src/data/OutfitItemData.js";
import { PossessionData }  from "./src/data/PossessionData.js";

// -- INIT ------------------------------------------------------
// Fires before the world loads. Document classes and settings must
// be registered here so they're available before any documents load.
Hooks.once("init", () => {
	info("Initializing");

	Object.assign(CONFIG.Actor.dataModels, { character: CharacterData, npc: NpcData, steading: SteadingData });
	Object.assign(CONFIG.Item.dataModels, {
		move:        MoveData,
		arcanum:     ArcanumData,
		playbook:    PlaybookData,
		insert:      InsertData,
		improvement: ImprovementData,
		npc:         NpcItemData,
		outfitItem:  OutfitItemData,
		possession:  PossessionData,
	});

	registerSettings();

	Handlebars.registerHelper("resourceChecks", resource => {
		if (!resource) return [];
		const { current, max, labels } = resource;
		return Array.from({ length: max ?? 0 }, (_, i) => ({ checked: i < (current ?? 0), label: labels?.[i] || null }));
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

	const StonetopNpcSheet = createStonetopNpcSheetClass(StonetopActorSheet);
	foundry.documents.collections.Actors.registerSheet("stonetop", StonetopNpcSheet, {
		types: ["npc"],
		makeDefault: true,
		label: "Stonetop NPC Sheet",
	});

	const StonetopSteadingSheet = createStonetopSteadingSheetClass(StonetopActorSheet);
	foundry.documents.collections.Actors.registerSheet("stonetop", StonetopSteadingSheet, {
		types: ["steading"],
		makeDefault: true,
		label: "Stonetop Steading Sheet",
	});

	const StonetopMoveSheet = createStonetopMoveSheetClass(foundry.appv1.sheets.ItemSheet);
	foundry.documents.collections.Items.registerSheet("stonetop", StonetopMoveSheet, {
		types: ["move"],
		makeDefault: true,
		label: "Stonetop Move Sheet",
	});

	foundry.applications.handlebars.loadTemplates({
		"stonetop.actor-header":     "systems/stonetop/templates/actor/partials/actor-header.hbs",
		"stonetop.actor-stats":      "systems/stonetop/templates/actor/partials/actor-stats.hbs",
		"stonetop.actor-attributes": "systems/stonetop/templates/actor/partials/actor-attributes.hbs",
		"stonetop.tab-playbook":           "systems/stonetop/templates/actor/partials/tab-playbook.hbs",
		"stonetop.introductions-section":  "systems/stonetop/templates/actor/partials/introductions-section.hbs",
		"stonetop.tab-moves":        "systems/stonetop/templates/actor/partials/tab-moves.hbs",
		"stonetop.tab-equipment":    "systems/stonetop/templates/actor/partials/tab-equipment.hbs",
		"stonetop.tab-arcana":       "systems/stonetop/templates/actor/partials/tab-arcana.hbs",
		"stonetop.arcanum-cards":    "systems/stonetop/templates/actor/partials/arcanum-cards.hbs",
		"stonetop.tab-followers":    "systems/stonetop/templates/actor/partials/tab-followers.hbs",
		"stonetop.follower-card":    "systems/stonetop/templates/actor/partials/follower-card.hbs",
		"stonetop.tab-insert":        "systems/stonetop/templates/actor/partials/tab-insert.hbs",
		"stonetop.instinct-section":  "systems/stonetop/templates/actor/partials/instinct-section.hbs",
		"stonetop.move-group":       "systems/stonetop/templates/actor/partials/move-group.hbs",
		"stonetop.choice-group":     "systems/stonetop/templates/actor/partials/choice-group.hbs",
		"stonetop.choice-row":       "systems/stonetop/templates/actor/partials/choice-row.hbs",
		"stonetop.choice-section":   "systems/stonetop/templates/actor/partials/lore-section.hbs",
		"stonetop.section-heading":  "systems/stonetop/templates/actor/partials/section-heading.hbs",
		"stonetop.section-sub-heading":  "systems/stonetop/templates/actor/partials/section-sub-heading.hbs",
		"stonetop.resource-track":   "systems/stonetop/templates/actor/partials/resource-track.hbs",
		"stonetop.steading":              "systems/stonetop/templates/actor/steading.hbs",
		"stonetop.choices-entry-fields":  "systems/stonetop/templates/item/partials/choices-entry-fields.hbs",
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
