import { registerSettings, getSetting, applyMoveDescriptionBodyClass } from "./module/settings.js";
import { createStonetopActorClass } from "./module/actors/StonetopActor.js";
import { createStonetopItemClass } from "./module/item/StonetopItem.js";
import { createStonetopArcanumSheetClass } from "./module/item/StonetopArcanumSheet.js";
import { createStonetopArcanumEditorSheetClass } from "./module/item/StonetopArcanumEditorSheet.js";
import { createStonetopMoveSheetClass } from "./module/item/StonetopMoveSheet.js";
import { createStonetopCharacterSheetClass } from "./module/actors/character/StonetopCharacterSheet.js";
import { createStonetopSteadingSheetClass } from "./module/actors/steading/StonetopSteadingSheet.js";
import { createStonetopMonsterSheetClass } from "./module/actors/monster/StonetopMonsterSheet.js";
import { createStonetopNpcSheetClass } from "./module/actors/npc/StonetopNpcSheet.js";
import { createClassicCharacterSheetClass } from "./module/actors/character/ClassicCharacterSheet.js";
import { createClassicSteadingSheetClass } from "./module/actors/steading/ClassicSteadingSheet.js";
import { BestiaryPageModel } from "./module/journal/BestiaryPageModel.js";
import { LocationPageModel } from "./module/journal/LocationPageModel.js";
import { CharacterModel } from "./module/data-models/CharacterModel.js";
import { SteadingModel } from "./module/data-models/SteadingModel.js";
import { MonsterModel } from "./module/data-models/MonsterModel.js";
import { NpcModel } from "./module/data-models/NpcModel.js";
import { MoveModel } from "./module/data-models/MoveModel.js";
import { PlaybookModel } from "./module/data-models/PlaybookModel.js";
import { NpcMoveModel } from "./module/data-models/NpcMoveModel.js";
import { MonsterMoveModel } from "./module/data-models/MonsterMoveModel.js";
import { ClassicTaylorItemModel } from "./module/data-models/ClassicTaylorItemModel.js";
import { createStonetopBestiaryPageSheetClass } from "./module/journal/StonetopBestiaryPageSheet.js";
import { createStonetopLocationPageSheetClass } from "./module/journal/StonetopLocationPageSheet.js";
import { onReady } from "./module/hooks/Ready.js";
import { onRenderActorSheet } from "./module/hooks/RenderActorSheet.js";
import { invalidateMonsterRefIndex } from "./module/bestiary/monster-ref-index.js";
import { ensureLocationSummaryIndex, applyLocationTooltips } from "./module/locations/location-tooltips.js";
import { restrictContentLinks } from "./module/journal/restrict-content-links.js";
import { addJournalShareButton } from "./module/journal/share-journal.js";
import { registerDrawTableEnricher } from "./module/journal/drawTableEnricher.js";
import { onRenderPause } from "./module/hooks/RenderPause.js";
import { registerStonetopSingletonHooks } from "./module/hooks/StonetopSingleton.js";
import { info } from "./module/utils/logger.js";
import { boldMissText } from "./module/utils/strings.js";
import { rollSeasonsCard, SPRING_SEASONS_RESULT } from "./module/utils/roll-engine.js";
import { markQuestionBullets } from "./module/utils/question-bullets.js";
import { wrapStonetopGlyphsInEl } from "./module/utils/glyphs.js";
import { applyJournalSpiralBullets, resolveEntry } from "./module/utils/journal-spiral-bullets.js";
import { applyGearTermTooltips } from "./module/utils/gear-term-tooltips.js";
import { SETTING_OVERVIEW_JOURNAL } from "./module/utils/seeded-journals.js";
import { applyJournalCheckboxes } from "./module/utils/journal-checkboxes.js";
import { applyJournalRollTables } from "./module/utils/journal-roll-tables.js";
import { bindSteadingImprovementDrag } from "./module/journal/steading-improvement-cards.js";
import { crossOffWouldBe, WBH_HERO_FLAG } from "./module/actors/character/WouldBeHeroAsterisk.js";
import { makeDialogsResizable, enableAutoHeightVerticalResize } from "./module/utils/resizable-dialogs.js";
import { registerStonetopWindowTheme } from "./module/utils/window-theme.js";
import { registerClassicSheetSupport } from "./module/classic/classic-support.js";

// -- INIT ------------------------------------------------------
Hooks.once("init", () => {
	info("Initializing");

	registerSettings();
	registerStonetopSingletonHooks();

	// Inline "@DrawTable[<uuid>]{<label>}" roll buttons in journal prose — a GM-only draw from the
	// referenced RollTable (e.g. the Wonder Tables pack). Complements applyJournalRollTables (the
	// static-<table> roller) rather than replacing it; inert until a journal emits such a token.
	registerDrawTableEnricher();

	// Every window and modal in the system is drag-resizable; the ad-hoc
	// Dialog popups we spawn from sheets default to resizable too. The companion
	// patch lets auto-height windows (most of our modals) be dragged taller/shorter,
	// which core otherwise blocks by refitting auto-height windows to their content.
	makeDialogsResizable();
	enableAutoHeightVerticalResize();

	// Skin a curated allowlist of core Foundry windows (e.g. User Configuration)
	// to match our sheets/modals; scoped to a marker class so nothing else moves.
	registerStonetopWindowTheme();

	// Classic (ported Taylor-Nightingale) sheet: register his Handlebars helpers + markdown
	// pipeline + partials (isolated from the Minimal sheet) so its vendored templates render.
	registerClassicSheetSupport();

	Handlebars.registerHelper("format", (key, options) => game.i18n.format(String(key), options.hash));
	Handlebars.registerHelper("boldMissText", value => boldMissText(value));
	Handlebars.registerHelper("eq", (a, b) => a === b);
	Handlebars.registerHelper("or", (...args) => args.slice(0, -1).some(Boolean));
	Handlebars.registerHelper("and", (...args) => args.slice(0, -1).every(Boolean));

	const _STAT_LABEL_KEYS = {
		str: "stonetop.character.stats.strength",
		dex: "stonetop.character.stats.dexterity",
		int: "stonetop.character.stats.intelligence",
		wis: "stonetop.character.stats.wisdom",
		con: "stonetop.character.stats.constitution",
		cha: "stonetop.character.stats.charisma",
	};
	Handlebars.registerHelper("statLabel", key => game.i18n.localize(_STAT_LABEL_KEYS[String(key)] ?? String(key)));

	Handlebars.registerHelper("resourceChecks", resource => {
		if (!resource) return [];
		const { current, max, labels } = resource;
		return Array.from({ length: max }, (_, i) => ({ checked: i < current, label: labels[i] || null }));
	});

	const _flatPoolItems = pool => {
		if (!pool) return [];
		const total = pool.max ?? 9;
		return Array.from({ length: total }, (_, i) => ({ checked: i < pool.current, index: i }));
	};

	Handlebars.registerHelper("poolItems", _flatPoolItems);

	Handlebars.registerHelper("poolGroups", pool => {
		const items = _flatPoolItems(pool);
		const groups = [];
		for (let i = 0; i < items.length; i += 3) groups.push(items.slice(i, i + 3));
		return groups;
	});

	Handlebars.registerHelper("times", n => Array.from({ length: n ?? 0 }, (_, i) => i));

	Handlebars.registerHelper("repeatChecks", move => {
		if (!move?.repeat) return [];
		const { max, current } = move.repeat;
		const lastOwnedId = move.ownedIds[move.ownedIds.length - 1] ?? null;
		return Array.from({ length: max }, (_, i) => ({
			checked:  i < current,
			ownedId:  i < current ? lastOwnedId : null,
			disabled: move.isStarting || move.locked || (!(i < current) && i !== current),
		}));
	});

	Handlebars.registerHelper("steadingTrack", (currentValue, defaultValue = 0) => {
		const raw = currentValue?.value ?? currentValue;
		const current = Number(raw ?? defaultValue);
		return Array.from({ length: 5 }, (_, i) => {
			const val = i - 1;
			return { val, label: (val >= 0 ? "+" : "") + val, checked: val === current };
		});
	});

	Handlebars.registerHelper("steadingDefenseTrack", (currentValue, defaultValue = 0) => {
		const raw = currentValue?.value ?? currentValue;
		const current = Number(raw ?? defaultValue);
		const sublabels = ["feeble", "mediocre", "strong", "formidable", "legendary"];
		return Array.from({ length: 5 }, (_, i) => {
			const val = i - 1;
			return { val, label: (val >= 0 ? "+" : "") + val, sublabel: sublabels[i], checked: val === current };
		});
	});

	CONFIG.Actor.documentClass = createStonetopActorClass(CONFIG.Actor.documentClass);
	CONFIG.Item.documentClass  = createStonetopItemClass(CONFIG.Item.documentClass);

	// System data models for each Actor/Item subtype (replaces template.json).
	CONFIG.Actor.dataModels ??= {};
	CONFIG.Item.dataModels  ??= {};
	CONFIG.Actor.dataModels.character = CharacterModel;
	CONFIG.Actor.dataModels.stonetop  = SteadingModel;
	CONFIG.Actor.dataModels.monster   = MonsterModel;
	CONFIG.Actor.dataModels.npc       = NpcModel;
	CONFIG.Item.dataModels.move        = MoveModel;
	CONFIG.Item.dataModels.playbook    = PlaybookModel;
	CONFIG.Item.dataModels.npcMove     = NpcMoveModel;
	CONFIG.Item.dataModels.monsterMove = MonsterMoveModel;
	// Classic Taylor-Nightingale embedded item types — registered (one shared passthrough
	// model) ONLY so his items survive load for Path B migration; see ClassicTaylorItemModel.
	CONFIG.Item.dataModels.arcanum     = ClassicTaylorItemModel;
	CONFIG.Item.dataModels.possession  = ClassicTaylorItemModel;
	CONFIG.Item.dataModels.insert      = ClassicTaylorItemModel;
	CONFIG.Item.dataModels.outfitItem  = ClassicTaylorItemModel;
	CONFIG.Item.dataModels.npc         = ClassicTaylorItemModel;

	// World default for which sheet STYLE is the makeDefault one. Players can still pick the
	// other per-actor via the sheet header's Sheet config; this only sets the world default.
	// (requiresReload, since registration happens once here at init.)
	const classicIsDefault = getSetting("defaultSheetStyle") === "classic";

	const StonetopCharacterSheet = createStonetopCharacterSheetClass(ActorSheet);
	Actors.registerSheet("stonetop", StonetopCharacterSheet, {
		types:       ["character"],
		makeDefault: !classicIsDefault,
		label:       "Stonetop Character Sheet (Minimal)",
	});
	const ClassicCharacterSheet = createClassicCharacterSheetClass(StonetopCharacterSheet);
	Actors.registerSheet("stonetop", ClassicCharacterSheet, {
		types:       ["character"],
		makeDefault: classicIsDefault,
		label:       "Stonetop Character Sheet (Classic)",
	});

	const StonetopSteadingSheet = createStonetopSteadingSheetClass(ActorSheet);
	Actors.registerSheet("stonetop", StonetopSteadingSheet, {
		types:       ["stonetop"],
		makeDefault: !classicIsDefault,
		label:       "Stonetop Steading Sheet (Minimal)",
	});
	const ClassicSteadingSheet = createClassicSteadingSheetClass(StonetopSteadingSheet);
	Actors.registerSheet("stonetop", ClassicSteadingSheet, {
		types:       ["stonetop"],
		makeDefault: classicIsDefault,
		label:       "Stonetop Steading Sheet (Classic)",
	});

	const StonetopMonsterSheet = createStonetopMonsterSheetClass(ActorSheet);
	Actors.registerSheet("stonetop", StonetopMonsterSheet, {
		types:       ["monster"],
		makeDefault: true,
		label:       "Stonetop Monster Sheet",
	});

	const StonetopNpcSheet = createStonetopNpcSheetClass(ActorSheet);
	Actors.registerSheet("stonetop", StonetopNpcSheet, {
		types:       ["npc"],
		makeDefault: true,
		label:       "Stonetop NPC Sheet",
	});

	// Bestiary entry as a custom JournalEntryPage subtype.
	CONFIG.JournalEntryPage.dataModels ??= {};
	CONFIG.JournalEntryPage.dataModels["bestiary"] = BestiaryPageModel;
	const JournalPageSheetV1 = foundry.appv1?.sheets?.JournalPageSheet ?? globalThis.JournalPageSheet;
	const StonetopBestiaryPageSheet = createStonetopBestiaryPageSheetClass(JournalPageSheetV1);
	foundry.applications.apps.DocumentSheetConfig.registerSheet(JournalEntryPage, "stonetop", StonetopBestiaryPageSheet, {
		types:       ["bestiary"],
		makeDefault: true,
		label:       "Stonetop Bestiary Page",
	});

	// Gazetteer places as a structured JournalEntryPage subtype (sectioned, with
	// per-section inline editing) — mirrors the bestiary page above.
	CONFIG.JournalEntryPage.dataModels["location"] = LocationPageModel;
	const StonetopLocationPageSheet = createStonetopLocationPageSheetClass(JournalPageSheetV1);
	foundry.applications.apps.DocumentSheetConfig.registerSheet(JournalEntryPage, "stonetop", StonetopLocationPageSheet, {
		types:       ["location"],
		makeDefault: true,
		label:       "Stonetop Location Page",
	});

	// The Chronicle (session-zero record) reuses the same sectioned page model + sheet,
	// so its Bonds / Asked-of-the-others Q&A is inline-editable like a location's "In
	// Play" questions. Chronicle pages set every section's group to "glance", so no act
	// banners render. See utils/chronicle.js.
	CONFIG.JournalEntryPage.dataModels["chronicle"] = LocationPageModel;
	foundry.applications.apps.DocumentSheetConfig.registerSheet(JournalEntryPage, "stonetop", StonetopLocationPageSheet, {
		types:       ["chronicle"],
		makeDefault: true,
		label:       "Stonetop Chronicle Page",
	});

	const StonetopArcanumSheet = createStonetopArcanumSheetClass(ItemSheet);
	Items.registerSheet("stonetop", StonetopArcanumSheet, {
		types:       ["move"],
		makeDefault: true,
		label:       "Stonetop Arcanum",
	});

	// GM-facing move authoring sheet — a selectable alternate (the arcanum reader above
	// stays the default so arcana cards still render). Pick it via the sheet header's
	// "Sheet" config to edit a move's mechanics.
	const StonetopMoveSheet = createStonetopMoveSheetClass(ItemSheet);
	Items.registerSheet("stonetop", StonetopMoveSheet, {
		types:       ["move"],
		makeDefault: false,
		label:       "Stonetop Move Editor",
	});

	// Player-facing custom-arcanum authoring sheet — a selectable alternate. The character
	// sheet's "Create Custom Arcanum" flow stamps this on the item's flags.core.sheetClass so a
	// custom arcanum opens straight into the editor; shipped pack arcana keep the reader default.
	const StonetopArcanumEditorSheet = createStonetopArcanumEditorSheetClass(ItemSheet);
	Items.registerSheet("stonetop", StonetopArcanumEditorSheet, {
		types:       ["move"],
		makeDefault: false,
		label:       "Stonetop Arcanum Editor",
	});

	loadTemplates({
		"stonetop.arcanum-sheet":    "systems/stonetop/templates/item/arcanum-sheet.hbs",
		"stonetop.actor-header":     "systems/stonetop/templates/actor/partials/actor-header.hbs",
		"stonetop.actor-stats":      "systems/stonetop/templates/actor/partials/actor-stats.hbs",
		"stonetop.actor-vitals":     "systems/stonetop/templates/actor/partials/actor-vitals.hbs",
		"stonetop.tab-details":      "systems/stonetop/templates/actor/partials/tab-details.hbs",
		"stonetop.tab-moves":        "systems/stonetop/templates/actor/partials/tab-moves.hbs",
		"stonetop.tab-equipment":    "systems/stonetop/templates/actor/partials/tab-equipment.hbs",
		"stonetop.tab-invocations":  "systems/stonetop/templates/actor/partials/tab-invocations.hbs",
		"stonetop.tab-followers":    "systems/stonetop/templates/actor/partials/tab-followers.hbs",
		"stonetop.tab-arcana":       "systems/stonetop/templates/actor/partials/tab-arcana.hbs",
		"stonetop.tab-post-death":      "systems/stonetop/templates/actor/partials/tab-post-death.hbs",
		"stonetop.tab-special-moves":   "systems/stonetop/templates/actor/partials/tab-special-moves.hbs",
		"stonetop.move-group":           "systems/stonetop/templates/actor/partials/move-group.hbs",
		"stonetop.move-mark-level":      "systems/stonetop/templates/actor/partials/move-mark-level.hbs",
		"stonetop.sidebar-move-list":    "systems/stonetop/templates/actor/partials/sidebar-move-list.hbs",
		"stonetop.lore-section":          "systems/stonetop/templates/actor/partials/lore-section.hbs",
		"stonetop.lore-options-edit":     "systems/stonetop/templates/actor/partials/lore-options-edit.hbs",
		"stonetop.lore-options-readonly": "systems/stonetop/templates/actor/partials/lore-options-readonly.hbs",
		"stonetop.lore-arcana-image":     "systems/stonetop/templates/actor/partials/lore-arcana-image.hbs",
		"stonetop.possession-choice-groups": "systems/stonetop/templates/actor/partials/possession-choice-groups.hbs",
		"stonetop.section-heading":  "systems/stonetop/templates/actor/partials/section-heading.hbs",
		"stonetop.section-edit-toggle": "systems/stonetop/templates/actor/partials/section-edit-toggle.hbs",
		"stonetop.details-section-edit-toggle": "systems/stonetop/templates/actor/partials/details-section-edit-toggle.hbs",
		"stonetop.follower-section-edit": "systems/stonetop/templates/actor/partials/follower-section-edit.hbs",
		"stonetop.resource-track":   "systems/stonetop/templates/actor/partials/resource-track.hbs",
		"stonetop.steading-section-toggle":   "systems/stonetop/templates/actor/partials/steading-section-toggle.hbs",
		"stonetop.steading-tab-overview":     "systems/stonetop/templates/actor/partials/steading-tab-overview.hbs",
		"stonetop.steading-tab-neighbors":    "systems/stonetop/templates/actor/partials/steading-tab-neighbors.hbs",
		"stonetop.steading-tab-improvements": "systems/stonetop/templates/actor/partials/steading-tab-improvements.hbs",
		"stonetop.steading-tab-moves":        "systems/stonetop/templates/actor/partials/steading-tab-moves.hbs",
		"stonetop.steading-tab-notes":        "systems/stonetop/templates/actor/partials/steading-tab-notes.hbs",
		"stonetop.monster-sheet":             "systems/stonetop/templates/actor/monster.hbs",
		"stonetop.bestiary-line-list":        "systems/stonetop/templates/actor/partials/bestiary-line-list.hbs",
		"stonetop.bestiary-page":             "systems/stonetop/templates/journal/bestiary.hbs",
		"stonetop.location-page":             "systems/stonetop/templates/journal/location.hbs",
		"stonetop.bestiary-section-head":     "systems/stonetop/templates/journal/partials/bestiary-section-head.hbs",
		"stonetop.bestiary-group-section":    "systems/stonetop/templates/journal/partials/bestiary-group-section.hbs",
		"stonetop.introductions-dialog":      "systems/stonetop/templates/dialogs/introductions.hbs",
		"stonetop.editable-field":            "systems/stonetop/templates/actor/partials/editable-field.hbs",
		"stonetop.selection-input":           "systems/stonetop/templates/actor/partials/selection-input.hbs",
		"stonetop.selection-chips":           "systems/stonetop/templates/actor/partials/selection-chips.hbs",
	});
});

// -- RENDER PAUSE ----------------------------------------------
// "renderPause" (v11) was renamed in v12+; cover all known variants and
// pauseGame so the text override fires whenever pause state changes.
Hooks.on("renderPause", onRenderPause);
Hooks.on("renderPauseBanner", onRenderPause);
Hooks.on("pauseGame", (paused) => paused && onRenderPause());

// -- READY -----------------------------------------------------
Hooks.once("ready", onReady);
Hooks.once("ready", () => applyMoveDescriptionBodyClass(getSetting("showMoveDescriptionsInChat")));

// -- RENDER ACTOR SHEET ----------------------------------------
Hooks.on("renderActorSheet", onRenderActorSheet);

// -- LOCATION CROSS-LINK TOOLTIPS ------------------------------
// Give cross-links into the Locations pack a useful hover summary instead of the
// default "Journal Entry". Covers the journal sheet/page render hooks across
// Foundry v12–v14; the index warms on ready so the first hover is instant.
Hooks.once("ready", () => ensureLocationSummaryIndex());
const _onJournalRender = (app, html) => {
	// Give cross-links their hover summary FIRST, then neuter any a player can't
	// follow. Order matters: restrictContentLinks carries the just-stamped
	// data-tooltip onto the de-linked span, so a player still gets the description
	// on hover for Locations & Lore — while the GM-only bestiary codex is flattened
	// to plain text with no tooltip. No-op for GMs (they keep every link). The
	// tooltip index is async, so chain the restriction after it resolves.
	applyLocationTooltips(html).then(() => restrictContentLinks(html));
	// Spiral bullets / question-spirals for this system's prose journals.
	applyJournalSpiralBullets(app, html);
	// Gear/weapon-tag hover tooltips for the curated Setting Overview prose (the
	// Character Creation FAQ's "various tags," the Gear: Terms & Value page). Scoped
	// to that one journal — other prose's em-emphasis on common words like
	// "near"/"close"/"far" would draw spurious range tooltips. Mirrors what
	// SettingOverviewDialog does when it renders the same pages outside a journal.
	if (resolveEntry(app)?.name === SETTING_OVERVIEW_JOURNAL) {
		const root = html?.jquery ? html[0] : html;
		root?.querySelectorAll?.(".journal-page-content").forEach(applyGearTermTooltips);
	}
	// Tick-off the requirement check-lists in view mode (state stored on the page).
	applyJournalCheckboxes(app, html);
	// Roll the random tables straight from their "Roll" header.
	applyJournalRollTables(app, html);
	// Make baked steading-improvement cards draggable onto the Stonetop sheet.
	bindSteadingImprovementDrag(html);
};
for (const hook of ["renderJournalSheet", "renderJournalEntrySheet", "renderJournalPageSheet", "renderJournalEntryPageSheet"]) {
	Hooks.on(hook, _onJournalRender);
}

// -- JOURNAL SHARE BUTTON --------------------------------------
// Give the GM a one-click eye button on the journal entry's header bar to toggle
// whether players can see it (and at what access level). Scoped to the whole-entry
// sheet — v12 fires renderJournalSheet, v13+ renderJournalEntrySheet.
for (const hook of ["renderJournalSheet", "renderJournalEntrySheet"]) {
	Hooks.on(hook, addJournalShareButton);
}

// -- BESTIARY CROSS-LINK INDEX ---------------------------------
// Drop the cached creature name index when a world monster is added, removed,
// or renamed/re-conceived so cross-links stay accurate.
Hooks.on("createActor", (actor) => { if (actor?.type === "monster") invalidateMonsterRefIndex(); });
Hooks.on("deleteActor", (actor) => { if (actor?.type === "monster") invalidateMonsterRefIndex(); });
Hooks.on("updateActor", (actor, changes) => {
	if (actor?.type !== "monster") return;
	if ("name" in (changes ?? {}) || changes?.system?.concept !== undefined) invalidateMonsterRefIndex();
});

// A custom arcanum is a WORLD move/arcanum item, so editing it doesn't trigger the owning
// character's sheet to re-render (the actor's own data didn't change). Nudge every open character
// sheet when one is edited or removed so the authored card reflects the change immediately. The
// repository never caches world arcana, so the re-render reads the fresh payload.
function _isCustomArcanumItem(item) {
	return item?.type === "move"
		&& item?.system?.moveType === "arcanum"
		&& String(item?.flags?.stonetop?.slug ?? "").startsWith("custom-arcanum-");
}
function _rerenderCharacterSheets() {
	for (const app of Object.values(ui.windows ?? {})) {
		if (app?.actor?.type === "character" && app.rendered) app.render(false);
	}
}
Hooks.on("updateItem", (item) => { if (_isCustomArcanumItem(item)) _rerenderCharacterSheets(); });
Hooks.on("deleteItem", (item) => { if (_isCustomArcanumItem(item)) _rerenderCharacterSheets(); });

// -- RECOVER LOCK ----------------------------------------------
// The Recover special move can't be used again until the character takes more
// damage; clear its lock flag the moment HP drops.
Hooks.on("preUpdateActor", (actor, changes) => {
	if (actor?.type !== "character") return;
	const newHp = foundry.utils.getProperty(changes, "system.attributes.hp.value");
	if (newHp === undefined) return;
	const oldHp = actor.system?.attributes?.hp?.value ?? 0;
	if (newHp < oldHp && actor.getFlag("stonetop", "recover.spent")) {
		foundry.utils.setProperty(changes, "flags.stonetop.recover.spent", false);
	}
});

// -- CHAT SPEAKER ALIAS ----------------------------------------
Hooks.on("preCreateChatMessage", (message) => {
	const { token: tokenId, actor: actorId } = message.speaker ?? {};
	const actor = (tokenId ? canvas.tokens?.get(tokenId)?.actor : null)
		?? (actorId ? game.actors?.get(actorId) : null);
	if (!actor || actor.type !== "character") return;
	const playbookName = actor.system?.playbook?.name ?? "";
	if (!playbookName) return;
	message.updateSource({ "speaker.alias": `${actor.name} ${playbookName}` });
});

// -- BLIND / PRIVATE ROLLS -------------------------------------
// Our roll cards print the rolled total (and result tier) in the message flavor,
// which Foundry renders for everyone regardless of whether the roll's result is
// visible to them. So for a viewer who isn't allowed to see the result (blind GM
// rolls, private rolls), drop our card entirely: that lets the `:has(.stonetop-roll-card)`
// rule stop hiding Foundry's own native dice block, which renders as a "??? = ?"
// hidden-roll placeholder. Runs before the button-wiring hooks below so they no-op.
function _chatStripBlindRoll(message, html) {
	if (message.isContentVisible) return;
	html.querySelector(".stonetop-roll-card")?.remove();
}

// -- CHAT-CARD PROSE TREATMENT ---------------------------------
function _chatProseTreatment(message, html) {
	markQuestionBullets(html);
	// Swap inline ◇/◆/○/●/□ ASCII for this system's styled glyphs in our chat-card
	// prose — matching the sheets and journals. Scoped to the card description
	// containers so a literal glyph someone types in chat is left alone.
	html.querySelectorAll(".stonetop-chat-move-description, .stonetop-roll-card-description, .stonetop-arcanum-chat-card")
		.forEach(el => wrapStonetopGlyphsInEl(el));
}

// -- STARTUP CARD: OPEN WELCOME GUIDE --------------------------
// The new-install welcome card carries a button into the first-session guide.
// The card is visible to everyone, but the guide is a GM tool, so hide it for
// players and wire it up for the GM.
function _chatWireStartupWelcome(message, html) {
	const btn = html.querySelector(".stonetop-startup-open-welcome");
	if (!btn) return;
	if (!game.user.isGM) { btn.style.display = "none"; return; }
	btn.addEventListener("click", () => game.stonetop?.openWelcome?.());
}

// -- MOVE DESCRIPTION TOGGLE -----------------------------------
function _chatWireDescToggle(message, html) {
	const toggle = html.querySelector(".stonetop-roll-card-desc-toggle");
	if (!toggle) return;
	toggle.addEventListener("click", () => {
		toggle.closest(".stonetop-roll-card")?.classList.toggle("desc-revealed");
	});
}

// -- DEBILITY DISADVANTAGE ANNOTATION -------------------------
// When a roll was penalised by a debility, annotate the
// "Disadvantage" condition in the chat card with the debility name.
function _chatAnnotateDebility(message, html) {
	const opts = message.rolls?.[0]?.options ?? {};
	const { stonetopDebility: debility, stonetopDebilityTooltip: tooltip } = opts;
	if (!debility) return;
	const pill = html.querySelector(".stonetop-roll-card .stonetop-condition-disadvantage");
	if (pill) {
		const hint = tooltip
			? `<span class="stonetop-debility-hint" data-tooltip="${tooltip}" data-tooltip-direction="UP">${debility}</span>`
			: debility;
		pill.innerHTML = `Disadvantage (${hint})`;
	}
}

// -- ROLL RESULT SHIFTING --------------------------------------
function _chatWireRollShifting(message, html) {
	// Only actual roll results can be shifted (_onRollShift operates on message.rolls).
	// Skip roll-less cards that merely reuse the .stonetop-card-buttons row — the
	// "ask the most hopeful to roll" prompt and the Become-a-Hero prompt — so they
	// don't get dead Shift Up/Down buttons injected.
	if (!message.rolls?.length) return;
	const cardButtons = html.querySelector(".stonetop-roll-card .stonetop-card-buttons");
	if (!cardButtons) return;

	if (!cardButtons.querySelector("[data-action='shiftUp']")) {
		cardButtons.insertAdjacentHTML("afterbegin", `
			<button data-action="shiftUp">Shift Up</button>
			<button data-action="shiftDown">Shift Down</button>
		`);
	}

	for (const button of cardButtons.querySelectorAll("[data-action='shiftUp'], [data-action='shiftDown']")) {
		button.style.display = game.user.isGM ? "" : "none";
		button.addEventListener("click", ev => _onRollShift(ev, message));
	}
	cardButtons.style.display = game.user.isGM ? "flex" : "none";
}

// -- BURN BRIGHTLY ---------------------------------------------
const BURN_BRIGHTLY_TOOLTIP =
	"When you have enough XP to Level Up (6 + twice your current level), " +
	"you may spend 2 XP after any roll you make to add +1 to that roll (max +1 per roll).";

function _chatWireBurnBrightly(message, html) {
	const cardButtons = html.querySelector(".stonetop-roll-card .stonetop-card-buttons");
	if (!cardButtons) return;

	const { token: tokenId, actor: actorId } = message.speaker ?? {};
	const actor = (tokenId ? canvas.tokens?.get(tokenId)?.actor : null)
		?? (actorId ? game.actors?.get(actorId) : null);

	if (!actor || actor.type !== "character" || !actor.isOwner) return;

	const alreadyBurned = message.getFlag("stonetop", "burnBrightly") ?? false;
	const xp    = actor.system?.attributes?.xp?.value    ?? 0;
	const level = actor.system?.attributes?.level?.value ?? 1;
	const canAfford = xp >= 6 + 2 * level;

	if (!canAfford && !alreadyBurned) return;

	const btn = document.createElement("button");
	btn.className = "stonetop-burn-brightly-btn";
	btn.innerHTML = `<span class="stonetop-burn-brightly-icon"></span> Burn brightly`;
	btn.dataset.tooltip = BURN_BRIGHTLY_TOOLTIP;
	btn.dataset.tooltipDirection = "UP";
	btn.disabled = alreadyBurned;

	cardButtons.appendChild(btn);
	cardButtons.style.display = "flex";

	if (alreadyBurned) return;

	btn.addEventListener("click", async () => {
		btn.disabled = true;
		const currentXp    = actor.system?.attributes?.xp?.value    ?? 0;
		const currentLevel = actor.system?.attributes?.level?.value ?? 1;
		if (currentXp < 6 + 2 * currentLevel) {
			ui.notifications.warn("You don't have enough XP to Burn Brightly.");
			btn.disabled = false;
			return;
		}
		try {
			const playbookName = actor.system?.playbook?.name ?? "";
			await actor.update({ "system.attributes.xp.value": currentXp - 2 });
			const newXp = currentXp - 2;
			const maxXp = 6 + 2 * currentLevel;
			ChatMessage.create({
				content: `-2 XP for Burning Brightly.<br>New XP: ${newXp} / ${maxXp}`,
				speaker: ChatMessage.getSpeaker({ actor }),
			});

			const rolls = message.rolls;
			const roll  = rolls.at(0);
			let opTerm  = roll.terms.find(t => t instanceof foundry.dice.terms.OperatorTerm && t.options.rollShifting);
			let numTerm = roll.terms.find(t => t instanceof foundry.dice.terms.NumericTerm  && t.options.rollShifting);
			const originalValue = opTerm && numTerm
				? Roll.safeEval(`${opTerm.operator}${numTerm.number}`)
				: 0;

			if (!numTerm) {
				roll.terms.push(
					opTerm  = new foundry.dice.terms.OperatorTerm({ operator: "+", options: { rollShifting: true } }),
					numTerm = new foundry.dice.terms.NumericTerm({ number: 1, options: { rollShifting: true } })
				);
			} else {
				numTerm.number = Math.abs(Roll.safeEval(`${opTerm.operator}${numTerm.number} + 1`));
			}
			if (numTerm.number === 1 && originalValue === 0 && opTerm.operator !== "+") opTerm.operator = "+";
			else if (numTerm.number === 0) opTerm.operator = "+";

			roll.resetFormula();
			await roll._evaluate();

			const speakerUpdate = playbookName ? { alias: `${actor.name} ${playbookName}` } : {};
			await message.update({
				rolls,
				// Regenerate the card so the readout, result label and per-tier outcome reflect the +1.
				flavor:  _shiftRollCardFlavor(message.flavor, roll.total, roll.formula),
				speaker: { ...message.speaker, ...speakerUpdate },
				flags:   { stonetop: { burnBrightly: true } },
			});
		} catch (err) {
			console.error("Stonetop | Error burning brightly:", err);
			btn.disabled = false;
		}
	});
}

// -- WOULD-BE HERO: BECOME A HERO ------------------------------
// Wire the "Become a Hero" button on asterisk-move prompt cards.
function _chatWireBecomeHero(message, html) {
	const btn = html.querySelector(".stonetop-become-hero-btn");
	if (!btn) return;

	const actor = game.actors?.get(btn.dataset.actorId);
	if (!actor?.isOwner) { btn.style.display = "none"; return; }
	if (actor.getFlag("stonetop", WBH_HERO_FLAG)) {
		btn.disabled = true;
		btn.innerHTML = `<i class="fas fa-star"></i> Already a Hero`;
		return;
	}

	btn.addEventListener("click", async () => {
		btn.disabled = true;
		await crossOffWouldBe(actor);
	});
}

// One render hook drives all of the above, in this order: the blind-roll strip
// MUST run first (it removes our card so the button-wiring helpers below no-op
// for viewers who can't see the result), then prose treatment, then the button
// and annotation passes. A single dispatch beats nine separate hook registrations
// each re-scanning the same message DOM on every chat render.
Hooks.on("renderChatMessageHTML", (message, html) => {
	_chatStripBlindRoll(message, html);
	_chatProseTreatment(message, html);
	_chatWireStartupWelcome(message, html);
	_chatWireDescToggle(message, html);
	_chatAnnotateDebility(message, html);
	_chatWireRollShifting(message, html);
	_chatWireBurnBrightly(message, html);
	_chatWireBecomeHero(message, html);
	_chatWireSeasonsRoll(message, html);
});

// -- SEASONS CHANGE: "ask the most hopeful to roll" -----------
// Wire the roll button on a spring Seasons Change prompt card (postSeasonsRollPrompt):
// any player can click it to make the +Fortunes roll for the table. The result posts
// its own card; we just disable the button locally so a stray double-click can't fire
// two rolls.
function _chatWireSeasonsRoll(message, html) {
	const btn = html.querySelector(".stonetop-seasons-roll-btn");
	if (!btn) return;

	btn.addEventListener("click", async () => {
		btn.disabled = true;
		const fortunes = Number(btn.dataset.fortunes) || 0;
		// The carried name ("Seasons Change — <season>") heads the result card; the
		// speaker is left to default to whoever clicked (see rollSeasonsCard).
		const title    = btn.dataset.alias || "Seasons Change — Spring";
		const formula  = fortunes >= 0 ? `2d6 + ${fortunes}` : `2d6 - ${-fortunes}`;
		try {
			await rollSeasonsCard({ formula, title, resultTable: SPRING_SEASONS_RESULT });
		} catch (err) {
			console.error("Stonetop | Error rolling Seasons Change from chat:", err);
			btn.disabled = false;
		}
	});
}

async function _onRollShift(event, message) {
	event.preventDefault();
	const button = event.currentTarget;
	button.disabled = true;

	try {
		const roll = message.rolls?.at(0);
		if (!roll) return;

		const shift = button.dataset.action === "shiftUp" ? 1 : -1;
		await _shiftRoll(roll, shift);

		await message.update({
			rolls:  message.rolls,
			flavor: _shiftRollCardFlavor(message.flavor, roll.total, roll.formula),
		});
	} catch (err) {
		console.error("Stonetop | Error shifting roll result:", err);
	} finally {
		button.disabled = false;
	}
}

async function _shiftRoll(roll, shift) {
	const shiftMap = { 1: "+", "-1": "-" };
	let opTerm = roll.terms.find(term => term instanceof foundry.dice.terms.OperatorTerm && term.options.rollShifting);
	let numTerm = roll.terms.find(term => term instanceof foundry.dice.terms.NumericTerm && term.options.rollShifting);
	let originalValue = `${opTerm?.operator ?? ""}${numTerm?.number ?? ""}`;
	if (originalValue !== "" && !Number.isNaN(Number(originalValue))) originalValue = Number(originalValue);

	if (!numTerm) {
		roll.terms.push(
			opTerm = new foundry.dice.terms.OperatorTerm({ operator: shiftMap[shift], options: { rollShifting: true } }),
			numTerm = new foundry.dice.terms.NumericTerm({ number: 1, options: { rollShifting: true } })
		);
	} else {
		numTerm.number = Math.abs(Roll.safeEval(`${opTerm.operator}${numTerm.number} + ${shift}`));
	}

	if (numTerm.number === 1 && originalValue === 0 && opTerm.operator !== shiftMap[shift]) {
		opTerm.operator = shiftMap[shift];
	} else if (numTerm.number === 0) {
		opTerm.operator = "+";
	}

	roll.resetFormula();
	await roll._evaluate();
}

function _shiftRollCardFlavor(flavor, total, formula = null) {
	if (!flavor) return flavor;

	const wrapper = document.createElement("div");
	wrapper.innerHTML = flavor;

	// Keep our own total + formula (which stand in for Foundry's hidden dice block)
	// in sync with the shifted roll. This runs for every roll card, including damage
	// cards that have no result tier. (The die-faces tooltip is left as-is: a shift
	// only adjusts the rollShifting modifier term, never the rolled d6 faces.)
	const numberEl = wrapper.querySelector(".stonetop-roll-card .stonetop-roll-result-number");
	if (numberEl) numberEl.textContent = total;
	if (formula != null) {
		const formulaEl = wrapper.querySelector(".stonetop-roll-card .stonetop-roll-formula");
		if (formulaEl) formulaEl.textContent = formula;
	}

	const resultEl = wrapper.querySelector(".stonetop-roll-card .stonetop-roll-result");
	const resultLabel = resultEl?.querySelector(".stonetop-roll-result-label");
	if (resultEl && resultLabel) {
		const result = _classifyShiftedTotal(total);
		resultEl.classList.remove("success", "partial", "failure", "critical");
		resultEl.classList.add(result.key);
		resultLabel.textContent = result.label;

		// Keep the per-tier outcome line (if any) in sync with the shifted tier. The
		// three outcomes are stashed on the result block as data-outcome-* by _rollCard.
		const details = resultEl.querySelector(".stonetop-roll-result-details");
		if (details) {
			const tierKey = result.key === "critical" ? "success" : result.key;
			const outcome = {
				success: resultEl.dataset.outcomeSuccess,
				partial: resultEl.dataset.outcomePartial,
				failure: resultEl.dataset.outcomeFailure,
			}[tierKey];
			if (outcome !== undefined) details.textContent = outcome;
		}
	}

	return wrapper.innerHTML;
}

function _classifyShiftedTotal(total) {
	if (total >= 12) return { key: "critical", label: "12+ Strong Hit" };
	if (total >= 10) return { key: "success", label: "Strong Hit" };
	if (total >= 7) return { key: "partial", label: "Weak Hit" };
	return { key: "failure", label: "Miss" };
}
