import { registerSettings } from "./src/settings.js";
import { createStonetopActorClass } from "./src/actors/StonetopActor.js";
import { createStonetopItemClass } from "./src/item/StonetopItem.js";
import { createStonetopActorSheetV2Class } from "./src/actors/StonetopActorSheetV2.js";
import { createStonetopCharacterSheetClass } from "./src/actors/character/StonetopCharacterSheet.js";
import { createStonetopSteadingSheetClass } from "./src/actors/steading/StonetopSteadingSheet.js";
import { createStonetopNpcSheetClass } from "./src/actors/npc/StonetopNpcSheet.js";
import { createStonetopMoveSheetClass } from "./src/item/StonetopMoveSheet.js";
import { createStonetopInsertSheetClass } from "./src/item/StonetopInsertSheet.js";
import { createStonetopArcanumSheetClass } from "./src/item/StonetopArcanumSheet.js";
import { createStonetopPossessionSheetClass } from "./src/item/StonetopPossessionSheet.js";
import { createStonetopFollowerSheetClass } from "./src/item/StonetopFollowerSheet.js";
import { createStonetopImprovementSheetClass } from "./src/item/StonetopImprovementSheet.js";
import { createStonetopItemSheetV2BaseClass } from "./src/item/StonetopItemSheetV2.js";
import { createStonetopSteadfastSheetClass } from "./src/item/StonetopSteadfastSheet.js";
import { onReady } from "./src/hooks/Ready.js";
import { onRenderPause } from "./src/hooks/RenderPause.js";
import { onPreCreateActor } from "./src/hooks/PreCreateActor.js";
import { onCreateActor } from "./src/hooks/CreateActor.js";
import { installBrokenImageHider } from "./src/hooks/HideBrokenImages.js";
import { onRenderChatMessage } from "./src/chat/xpMarkControl.js";
import { onUpdateActor, onSteadingCreatedOrDeleted } from "./src/hooks/SteadingChanged.js";
import { info } from "./src/utils/logger.js";
import { rich, hasText } from "./src/model/snapshot/RichText.js";
import { registerDrawTableEnricher } from "./src/journal/drawTableEnricher.js";
import { registerBlankFieldEnricher } from "./src/journal/blankFieldEnricher.js";
import { CharacterData } from "./src/data/CharacterData.js";
import { NpcData } from "./src/data/NpcData.js";
import { SteadingData } from "./src/data/SteadingData.js";
import { MoveData }        from "./src/data/MoveData.js";
import { ArcanumData }     from "./src/data/ArcanumData.js";
import { PlaybookData }    from "./src/data/PlaybookData.js";
import { SteadfastData }   from "./src/data/SteadfastData.js";
import { InsertData }      from "./src/data/InsertData.js";
import { ImprovementData } from "./src/data/ImprovementData.js";
import { FollowerData }    from "./src/data/FollowerData.js";
import { OutfitItemData }  from "./src/data/OutfitItemData.js";
import { PossessionData }  from "./src/data/PossessionData.js";
import "./src/dev/quenchTests.js"; // registers in-Foundry integration tests (no-op unless Quench is installed)

// -- INIT ------------------------------------------------------
// Fires before the world loads. Document classes and settings must
// be registered here so they're available before any documents load.
Hooks.once("init", () => {
	info("Initializing");

	installBrokenImageHider(); // hide broken-image placeholders when stonetop-art/ illustrations are absent

	Object.assign(CONFIG.Actor.dataModels, { character: CharacterData, npc: NpcData, steading: SteadingData });
	Object.assign(CONFIG.Item.dataModels, {
		move:        MoveData,
		arcanum:     ArcanumData,
		playbook:    PlaybookData,
		insert:      InsertData,
		improvement: ImprovementData,
		steadfast:   SteadfastData,
		follower:    FollowerData,
		npc:         FollowerData, // legacy alias: pre-rename follower items still load, then migrate to `follower`
		outfitItem:  OutfitItemData,
		possession:  PossessionData,
	});

	registerSettings();
	registerDrawTableEnricher();
	registerBlankFieldEnricher();

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
	Handlebars.registerHelper("join", (arr, sep) => (Array.isArray(arr) ? arr.join(typeof sep === "string" ? sep : ", ") : ""));
	Handlebars.registerHelper("concat", (...args) => args.slice(0, -1).join(""));

	// The single render path for game text. Accepts a RichText (enriched by enrichRichTextTree in
	// getData) or a bare string (rendered as markdown). One way to render text: {{rich field}}.
	Handlebars.registerHelper("rich", value => new Handlebars.SafeString(rich(value).render()));

	// Truthiness for an optional text field that may arrive as a bare string OR a RichText — used to
	// guard optional notes/subtitles in the shared heading partials: {{#if (hasText note)}}.
	Handlebars.registerHelper("hasText", hasText);

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

	// The shared ApplicationV2 actor base: size memory + submitOnChange + root-delegated listeners
	// (docs match the item base). All three actor sheets are on it.
	const ActorSheetV2Base = createStonetopActorSheetV2Class();

	const StonetopCharacterSheet = createStonetopCharacterSheetClass(ActorSheetV2Base);
	foundry.documents.collections.Actors.registerSheet("stonetop", StonetopCharacterSheet, {
		types: ["character"],
		makeDefault: true,
		label: "Stonetop Character Sheet",
	});

	const StonetopNpcSheet = createStonetopNpcSheetClass(ActorSheetV2Base);
	foundry.documents.collections.Actors.registerSheet("stonetop", StonetopNpcSheet, {
		types: ["npc"],
		makeDefault: true,
		label: "Stonetop NPC Sheet",
	});

	const StonetopSteadingSheet = createStonetopSteadingSheetClass(ActorSheetV2Base);
	foundry.documents.collections.Actors.registerSheet("stonetop", StonetopSteadingSheet, {
		types: ["steading"],
		makeDefault: true,
		label: "Stonetop Steading Sheet",
	});

	// All item sheets share this ApplicationV2 base: size memory + submitOnChange + view-state
	// handling (docs/appv2-migration.md). Actor sheets are still V1 pending Phases 3-5.
	const ItemSheetV2Base = createStonetopItemSheetV2BaseClass();

	const StonetopMoveSheet = createStonetopMoveSheetClass(ItemSheetV2Base);
	foundry.documents.collections.Items.registerSheet("stonetop", StonetopMoveSheet, {
		types: ["move"],
		makeDefault: true,
		label: "Stonetop Move Sheet",
	});

	const StonetopInsertSheet = createStonetopInsertSheetClass(ItemSheetV2Base);
	foundry.documents.collections.Items.registerSheet("stonetop", StonetopInsertSheet, {
		types: ["insert"],
		makeDefault: true,
		label: "Stonetop Insert Sheet",
	});

	const StonetopArcanumSheet = createStonetopArcanumSheetClass(ItemSheetV2Base);
	foundry.documents.collections.Items.registerSheet("stonetop", StonetopArcanumSheet, {
		types: ["arcanum"],
		makeDefault: true,
		label: "Stonetop Arcanum Sheet",
	});

	const StonetopPossessionSheet = createStonetopPossessionSheetClass(ItemSheetV2Base);
	foundry.documents.collections.Items.registerSheet("stonetop", StonetopPossessionSheet, {
		types: ["possession"],
		makeDefault: true,
		label: "Stonetop Possession Sheet",
	});

	const StonetopFollowerSheet = createStonetopFollowerSheetClass(ItemSheetV2Base);
	foundry.documents.collections.Items.registerSheet("stonetop", StonetopFollowerSheet, {
		types: ["follower", "npc"], // "npc" = legacy items awaiting migration to "follower"
		makeDefault: true,
		label: "Stonetop Follower Sheet",
	});

	const StonetopImprovementSheet = createStonetopImprovementSheetClass(ItemSheetV2Base);
	foundry.documents.collections.Items.registerSheet("stonetop", StonetopImprovementSheet, {
		types: ["improvement"],
		makeDefault: true,
		label: "Stonetop Steading Improvement Sheet",
	});

	const StonetopSteadfastSheet = createStonetopSteadfastSheetClass(ItemSheetV2Base);
	foundry.documents.collections.Items.registerSheet("stonetop", StonetopSteadfastSheet, {
		types: ["steadfast"],
		makeDefault: true,
		label: "Stonetop Steadfast Sheet",
	});

	foundry.applications.handlebars.loadTemplates({
		"stonetop.chat-move-roll":   "systems/stonetop/templates/chat/move-roll.hbs",
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
		"stonetop.follower-inventory": "systems/stonetop/templates/actor/partials/follower-inventory.hbs",
		"stonetop.outfit-items":       "systems/stonetop/templates/actor/partials/outfit-items.hbs",
		"stonetop.editable-field":   "systems/stonetop/templates/actor/partials/editable-field.hbs",
		"stonetop.editable-rich-block": "systems/stonetop/templates/actor/partials/editable-rich-block.hbs",
		"stonetop.tab-insert":        "systems/stonetop/templates/actor/partials/tab-insert.hbs",
		"stonetop.tab-notes":         "systems/stonetop/templates/actor/partials/tab-notes.hbs",
		"stonetop.selection-chips":   "systems/stonetop/templates/actor/partials/selection-chips.hbs",
		"stonetop.selection-input":   "systems/stonetop/templates/actor/partials/selection-input.hbs",
		"stonetop.instinct-section":  "systems/stonetop/templates/actor/partials/instinct-section.hbs",
		"stonetop.move-group":       "systems/stonetop/templates/actor/partials/move-group.hbs",
		"stonetop.move-row":         "systems/stonetop/templates/actor/partials/move-row.hbs",
		"stonetop.move-item":        "systems/stonetop/templates/actor/partials/move-item.hbs",
		"stonetop.choice-group":     "systems/stonetop/templates/actor/partials/choice-group.hbs",
		"stonetop.choice-row":       "systems/stonetop/templates/actor/partials/choice-row.hbs",
		"stonetop.improvement-group": "systems/stonetop/templates/actor/partials/improvement-group.hbs",
		"stonetop.choice-section":   "systems/stonetop/templates/actor/partials/lore-section.hbs",
		"stonetop.section-heading":  "systems/stonetop/templates/actor/partials/section-heading.hbs",
		"stonetop.panel-frame":              "systems/stonetop/templates/actor/partials/panel-frame.hbs",
		"stonetop.steading-stat-panel":      "systems/stonetop/templates/actor/partials/steading-stat-panel.hbs",
		"stonetop.steading-ratings-list":    "systems/stonetop/templates/actor/partials/steading-ratings-list.hbs",
		"stonetop.steading-assets":          "systems/stonetop/templates/actor/partials/steading-assets.hbs",
		"stonetop.steading-places-of-interest": "systems/stonetop/templates/actor/partials/steading-places-of-interest.hbs",
		"stonetop.steading-neighbor-places": "systems/stonetop/templates/actor/partials/steading-neighbor-places.hbs",
		"stonetop.section-sub-heading":  "systems/stonetop/templates/actor/partials/section-sub-heading.hbs",
		"stonetop.resource-track":   "systems/stonetop/templates/actor/partials/resource-track.hbs",
		"stonetop.resource-input":   "systems/stonetop/templates/actor/partials/resource-input.hbs",
		"stonetop.outfit-item-row":  "systems/stonetop/templates/actor/partials/outfit-item-row.hbs",
		"stonetop.steading":              "systems/stonetop/templates/actor/steading.hbs",
		"stonetop.choices-entry-fields":  "systems/stonetop/templates/item/partials/choices-entry-fields.hbs",
		"stonetop.choice-group-editor":   "systems/stonetop/templates/item/partials/choice-group-editor.hbs",
		"stonetop.arcanum-item-def":      "systems/stonetop/templates/item/partials/arcanum-item-def.hbs",
		"stonetop.arcanum-resource":      "systems/stonetop/templates/item/partials/arcanum-resource.hbs",
		"stonetop.arcanum-mystery-move":  "systems/stonetop/templates/item/partials/arcanum-mystery-move.hbs",
		"stonetop.string-list-editor":         "systems/stonetop/templates/item/partials/string-list-editor.hbs",
		"stonetop.follower-selection-field":   "systems/stonetop/templates/item/partials/follower-selection-field.hbs",
		"stonetop.follower-member-editor":     "systems/stonetop/templates/item/partials/follower-member-editor.hbs",
		"stonetop.follower-companion-type":    "systems/stonetop/templates/item/partials/follower-companion-type.hbs",
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

// -- PRE-CREATE ACTOR ------------------------------------------
// Give new NPCs our house default icon instead of Foundry's mystery-man.
Hooks.on("preCreateActor", onPreCreateActor);
Hooks.on("createActor", onCreateActor);

// -- RENDER CHAT MESSAGE ---------------------------------------
// Binds the "Mark XP" control on 6- roll cards.
Hooks.on("renderChatMessageHTML", onRenderChatMessage);
// -- STEADING CHANGES ------------------------------------------
// Character sheets show steading data (Prosperity); keep them live.
Hooks.on("updateActor", onUpdateActor);
Hooks.on("createActor", onSteadingCreatedOrDeleted);
Hooks.on("deleteActor", onSteadingCreatedOrDeleted);
