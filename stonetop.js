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
import { createStonetopOutfitItemSheetClass } from "./src/item/StonetopOutfitItemSheet.js";
import { createStonetopFollowerSheetClass } from "./src/item/StonetopFollowerSheet.js";
import { createStonetopImprovementSheetClass } from "./src/item/StonetopImprovementSheet.js";
import { createStonetopItemSheetV2BaseClass } from "./src/item/StonetopItemSheetV2.js";
import { createStonetopSteadfastSheetClass } from "./src/item/StonetopSteadfastSheet.js";
import { createStonetopPlaybookSheetClass } from "./src/item/StonetopPlaybookSheet.js";
import { onReady } from "./src/hooks/Ready.js";
import { onRenderPause } from "./src/hooks/RenderPause.js";
import { onPreCreateActor } from "./src/hooks/PreCreateActor.js";
import { onCreateActor } from "./src/hooks/CreateActor.js";
import { onPreUpdateSteadingPeople, onUpdateSteadingPeople } from "./src/hooks/SteadingPeopleChanged.js";
import { onUpdateLinkedActor, onDeleteLinkedActor } from "./src/hooks/LinkedActorChanged.js";
import { installBrokenImageHider } from "./src/hooks/HideBrokenImages.js";
import { onRenderChatMessage } from "./src/chat/xpMarkControl.js";
import { onUpdateActor, onSteadingCreatedOrDeleted } from "./src/hooks/SteadingChanged.js";
import { info } from "./src/utils/logger.js";
import { registerStonetopHelpers } from "./src/handlebars/helpers.js";
import { STONETOP_PARTIALS } from "./src/handlebars/partials.js";
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
import { TagGlossary }     from "./src/model/data/TagGlossary.js";
import { Advice }          from "./src/model/data/Advice.js";
import { TranslationCatalog } from "./src/i18n/TranslationCatalog.js";
import "./src/dev/quenchTests.js"; // registers in-Foundry integration tests (no-op unless Quench is installed)

// -- I18N INIT -------------------------------------------------
// Fires once translations are loaded, before init. The tag definitions a tooltip shows, and the
// "If you want to…" topic titles behind the sheets' ? buttons are ordinary localized strings, so
// both are read straight off them: no fetch, and no async race with the first sheet render.
Hooks.once("i18nInit", () => {
	TagGlossary.current = TagGlossary.fromTranslations(game.i18n?.translations?.stonetop?.tagGlossary);
	Advice.current      = Advice.fromTranslations(game.i18n?.translations?.stonetop?.advice);
	// Compendium prose for the active language, read the same way and for the same reason: a sheet
	// rendered before this point shows the English the packs ship with rather than failing.
	TranslationCatalog.current = TranslationCatalog.fromTranslations(game.i18n?.translations?.stonetop?.compendium);
});

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

	registerStonetopHelpers(Handlebars);

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

	const StonetopOutfitItemSheet = createStonetopOutfitItemSheetClass(ItemSheetV2Base);
	foundry.documents.collections.Items.registerSheet("stonetop", StonetopOutfitItemSheet, {
		types: ["outfitItem"],
		makeDefault: true,
		label: "Stonetop Inventory Item Sheet",
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

	const StonetopPlaybookSheet = createStonetopPlaybookSheetClass(ItemSheetV2Base);
	foundry.documents.collections.Items.registerSheet("stonetop", StonetopPlaybookSheet, {
		types: ["playbook"],
		makeDefault: true,
		label: "Stonetop Playbook Sheet",
	});

	foundry.applications.handlebars.loadTemplates(STONETOP_PARTIALS);
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

// -- STEADING PEOPLE -> NPC ACTORS -----------------------------
// A player may edit the roster but not create actors; the active GM's client does that work.
Hooks.on("preUpdateActor", onPreUpdateSteadingPeople);
Hooks.on("updateActor", onUpdateSteadingPeople);

// -- LINKED DOCUMENTS ------------------------------------------
// Steading rows show linked documents by live content link; redraw when one is renamed or deleted.
Hooks.on("updateActor", onUpdateLinkedActor);
Hooks.on("deleteActor", onDeleteLinkedActor);
