import { runStartupMigrations } from "./PbtaSheetConfig.js";
import { runMigrations } from "../migration/MigrationRunner.js";
import { ensureStonetopSingleton, remindDestinedOmenRoll } from "./StonetopSingleton.js";
import { seedCompendiumJournalsOnce, updateSeededJournalsOnVersionChange } from "./SeedCompendiums.js";
import { applySheetFont, applySheetFontScale, applyEditPencilRevealDelay, applyHideRollableIcon, applyReduceMotion, getSetting, setSetting } from "../settings.js";
import { EndOfSessionDialog } from "../dialogs/EndOfSessionDialog.js";
import { IntroductionsDialog } from "../dialogs/IntroductionsDialog.js";
import { SpringBurstDialog } from "../dialogs/SpringBurstDialog.js";
import { reopenOpenWalkthroughs, sessionZeroComplete } from "../dialogs/walkthrough-resume.js";
import { writeChronicle } from "../utils/chronicle.js";
import { ExpeditionDialog } from "../dialogs/ExpeditionDialog.js";
import { WeatherDialog } from "../dialogs/WeatherDialog.js";
import { WelcomeDialog } from "../dialogs/WelcomeDialog.js";
import { FoundryBasicsDialog } from "../dialogs/FoundryBasicsDialog.js";
import { CharacterCreationDialog } from "../actors/character/dialogs/CharacterCreationDialog.js";
import { readOnboardingResume, clearOnboardingResume } from "../actors/character/onboarding-resume.js";
import { playbookSlug } from "../utils/playbook-actors.js";
import { rollDieOfFate } from "../utils/die-of-fate.js";
import { findVisibleJournal, SETTING_OVERVIEW_JOURNAL } from "../utils/seeded-journals.js";
import { getStonetopSteadingActorOrWarn } from "../utils/world.js";

const _EOS_MACRO_NAME   = "End of Session";
const _EOS_MACRO_IMG    = "systems/stonetop/assets/icons/macros/truce.svg";
const _EOS_MACRO_SCRIPT = "game.stonetop?.openEndOfSession?.()";
const _EOS_HOTBAR_SLOT  = 10;

// The "(TEST ONLY) Populate World" dev macro, added to the Macro Directory but never
// the hotbar. Its body is the create-test-characters dev script — that gitignored file
// is the single source of truth, fetched at runtime (see _ensureTestPopulateMacro), so
// builds that omit it simply skip seeding the macro.
const _TEST_MACRO_NAME   = "(TEST ONLY) Populate World";
const _TEST_MACRO_SRC    = "systems/stonetop/scripts/local/create-test-characters.js";
const _TEST_MACRO_IMG    = "icons/svg/cog.svg";
const _TEST_MACRO_FOLDER = "For Testing Purposes";

// Retired hotbar macro — the Introductions walkthrough now launches from the
// Welcome guide, so the standalone macro is deleted rather than slotted (see
// _retireIntroductionsMacro). Name + command identify the system-created one.
const _INTRO_MACRO_NAME   = "Character Introductions";
const _INTRO_MACRO_SCRIPT = `\
const w = Object.values(ui.windows).find(w => w.id === "stonetop-introductions");
if (w?.rendered) { w.bringToTop(); return; }
game.stonetop?.openIntroductions?.();`;

// The ordered system hotbar macros (slots 1–5), in their canonical order. The
// single source of truth for both _ensureHotbarMacro (places any that are missing)
// and _reorderSystemMacros (snaps them into this order). End of Session (slot 10) is
// handled separately below because it also keys on its command. Seasons Change took
// the spring icon that Welcome used to carry; Welcome now uses the direction-signs.
const _SYSTEM_MACROS = [
	{ name: "Welcome to Stonetop", img: "systems/stonetop/assets/icons/macros/direction-signs.svg", command: "game.stonetop?.openWelcome?.()",        slot: 1 },
	{ name: "Seasons Change",      img: "systems/stonetop/assets/icons/macros/spring.svg",           command: "game.stonetop?.openSeasonsChange?.()", slot: 2 },
	{ name: "Run an Expedition",   img: "systems/stonetop/assets/icons/macros/treasure-map.svg",     command: "game.stonetop?.openExpedition?.()",     slot: 3 },
	{ name: "Weather",             img: "systems/stonetop/assets/icons/macros/sun-cloud.svg",        command: "game.stonetop?.openWeather?.()",        slot: 4 },
	{ name: "Die of Fate",         img: "systems/stonetop/assets/icons/macros/die-of-fate.svg",      command: "game.stonetop?.rollDieOfFate?.()",      slot: 5 },
];

// Bump to re-snap the system macros into their canonical slots once, on every client
// (the per-client `systemHotbarLayoutVersion` setting trails this until then). Bumped
// to 2 when Seasons Change was inserted at slot 2 and the rest shifted right.
const _HOTBAR_LAYOUT_VERSION = 2;

export async function onReady() {
	applySheetFont(getSetting("sheetFont"));
	applySheetFontScale(getSetting("sheetFontScale"));
	applyEditPencilRevealDelay(getSetting("editPencilRevealDelay"));
	applyHideRollableIcon(getSetting("hideRollableIcon"));
	applyReduceMotion(getSetting("reduceMotion"));
	// Data migrations first (consolidates legacy flag scope / settings after a system-id
	// rename, and — later schema versions — converts Taylor-origin worlds), so the
	// downstream startup migrations read the consolidated data.
	await runMigrations();
	await _migrateArmourToArmor();
	await runStartupMigrations();
	await ensureStonetopSingleton();

	game.stonetop ??= {};
	game.stonetop.openEndOfSession  = () => new EndOfSessionDialog().render(true);
	game.stonetop.openIntroductions = () => IntroductionsDialog.open();
	game.stonetop.openSpringBurst   = () => SpringBurstDialog.open();
	// Run the steading's Seasons Change homefront move from the hotbar: launch the
	// season-picker → roll flow (the same one the sheet's Seasons Change move uses)
	// WITHOUT opening the steading sheet — the dialog carries a "Stonetop" header
	// button to jump to the sheet if wanted. Warns if there's no steading yet.
	game.stonetop.openSeasonsChange = () => {
		getStonetopSteadingActorOrWarn()?.sheet._onSeasonsChange();
	};
	// Compile the recorded Introductions + Spring Burst answers into the shared
	// "Chronicle" journal and open it (GM-only). Callable from the Introductions
	// dialog's "Let spring break forth!" finish, the Expedition dialog, a macro, or
	// the console.
	game.stonetop.saveChronicle     = () => writeChronicle().then(j => j?.sheet?.render(true));
	game.stonetop.openExpedition    = () => ExpeditionDialog.open();
	game.stonetop.openWeather       = () => WeatherDialog.open();
	game.stonetop.openWelcome       = () => WelcomeDialog.open();
	game.stonetop.openFoundryBasics = () => FoundryBasicsDialog.open();
	// Preview/test the player-facing creation intro for any character on demand
	// (it normally only auto-pops on the owning player's client). Pass an actor, or
	// it falls back to the current user's assigned character:
	//   game.stonetop.openCharacterCreation()
	game.stonetop.openCharacterCreation = (actor = game.user.character) =>
		actor ? new CharacterCreationDialog(actor).render(true)
		      : ui.notifications.warn("No character to start creation for.");
	game.stonetop.rollDieOfFate     = rollDieOfFate;

	_registerCharacterAutoOpen();

	if (game.user.isGM) await seedCompendiumJournalsOnce();
	if (game.user.isGM) await updateSeededJournalsOnVersionChange();
	if (game.user.isGM) {
		await _retireIntroductionsMacro();
		// Place any missing system macros at their default slots (existing placements
		// are left alone, so a manual rearrangement sticks). Their fixed starting order
		// — 1 Welcome · 2 Seasons Change · 3 Run an Expedition · 4 Weather · 5 Die of
		// Fate · 10 End of Session — is applied per layout version by _reorderSystemMacros,
		// below.
		for (const macro of _SYSTEM_MACROS) await _ensureHotbarMacro(macro);
		await _ensureHotbarMacro({
			name: _EOS_MACRO_NAME, img: _EOS_MACRO_IMG, command: _EOS_MACRO_SCRIPT, slot: _EOS_HOTBAR_SLOT,
			match: m => m.command === _EOS_MACRO_SCRIPT && m.name === _EOS_MACRO_NAME,
		});
		await _reorderSystemMacros();
		await _ensureTestPopulateMacro();
	}
	if (game.user.isGM) await _postStartupWelcomeMessageOnce();
	if (game.user.isGM) await remindDestinedOmenRoll();

	await _openSettingOverview();

	// Reopen any session-zero walkthrough (Introductions / Let Spring Burst Forth)
	// that was open when this client last reloaded, at the page it was on. Per-client,
	// so it only fires for whoever actually had one open. See walkthrough-resume.js.
	//
	// The GM Welcome guide auto-opens here too, but its getData awaits a pack index so
	// it renders a beat later and would bury a resumed walkthrough — so when it's
	// opening, reopen only once it's up (with a timeout fallback so a failed/absent
	// Welcome render can't strand the resume).
	if (game.user.isGM && !getSetting("gmWelcomeShown") && !sessionZeroComplete()) {
		let resumed = false;
		const resume = () => { if (resumed) return; resumed = true; reopenOpenWalkthroughs(); };
		Hooks.once("renderWelcomeDialog", resume);
		setTimeout(resume, 2500);
		_openGmWelcomeGuide();
	} else {
		reopenOpenWalkthroughs();
	}
}

// Auto-open a freshly-minted character on its owner's screen. The GM stamps the
// new actor with an `autoOpenFor` flag (see WelcomeDialog._onCreateCharacter);
// the owning client opens the sheet and clears the flag so it only ever pops
// once. This is race-free either way: a character created while the owner is
// online fires `createActor` on their client, and one created while they're
// offline is caught by the ready-time sweep when they next log in.
function _registerCharacterAutoOpen() {
	Hooks.on("createActor", actor => _maybeOpenCharacterCreation(actor));
	for (const actor of game.actors) _maybeOpenCharacterCreation(actor);
}

// Greet a player with character creation, or resume an interrupted one:
//   • a freshly GM-minted character (the `autoOpenFor` flag names its owner) gets
//     the creation intro, once; and
//   • the player's own assigned character that still has no playbook is re-prompted
//     every load until they actually pick one: with saved progress it resumes
//     straight back into onboarding at that page (a reload mid-creation drops them
//     back in); with none it re-pops the creation intro. Either way a player who
//     reloaded before choosing a playbook lands back in creation rather than on a
//     blank sheet they'd have to start onboarding from themselves.
// A character that already has a playbook is finished (or was explicitly saved):
// only a brand-new mint pops its sheet; a reload leaves a finished character alone.
function _maybeOpenCharacterCreation(actor) {
	if (actor?.type !== "character") return;
	const mintedForMe  = actor.getFlag?.("stonetop", "autoOpenFor") === game.user.id;
	const isMyAssigned = !game.user.isGM && game.user.character?.id === actor.id;
	if (!mintedForMe && !isMyAssigned) return;
	// Owner-only flag; drop it first so the mint greeting only ever fires once.
	if (mintedForMe) actor.unsetFlag("stonetop", "autoOpenFor").catch(() => {});

	if (playbookSlug(actor)) {
		// Finished — never re-enter creation. Clear any progress flag / resume
		// snapshot a mid-creation "Save & close" (or an edit pass) left behind, so the
		// GM roster reads "Finished" rather than a stale "exited"/page note.
		actor.unsetFlag?.("stonetop", "onboardingProgress").catch(() => {});
		clearOnboardingResume(actor);
		if (mintedForMe) actor.sheet.render(true);
		return;
	}

	// No playbook yet. When there's a saved snapshot (picked playbook + selections,
	// autosaved client-side by _launchOnboarding), resume straight into onboarding at
	// that page; otherwise greet them with the creation intro — its "Create Character"
	// button walks them through the picker / onboarding and then opens their finished
	// sheet (see CharacterCreationDialog / _onNewCharacter's `openSheetWhenDone`). This
	// fires for both a fresh mint and the player's own assigned-but-unstarted character,
	// so reloading before picking a playbook re-prompts rather than stranding them.
	const snap = readOnboardingResume(actor);
	if (snap?.playbookUuid && snap?.selections) {
		actor.sheet._onNewCharacter({ openSheetWhenDone: true, resume: true });
	} else {
		new CharacterCreationDialog(actor).render(true);
	}
}

// Pop the first-session Welcome guide for the GM until either they tick "Don't show
// this automatically" (which sets gmWelcomeShown) or they finish both session-zero
// walkthroughs — the guided Introductions and Let Spring Burst Forth (sessionZeroComplete).
// Until one of those, the guide keeps greeting the GM across the first few loads.
function _openGmWelcomeGuide() {
	if (getSetting("gmWelcomeShown") || sessionZeroComplete()) return;
	WelcomeDialog.open();
}

// Pop the Setting Overview journal open so a fresh-start user lands on the
// world's orientation material. Two cases:
//   • everyone (GM included) sees it once per client the first time they connect,
//     guarded by the client-scoped `settingOverviewShown` flag so it never
//     re-interrupts later sessions; and
//   • a player with no character assigned yet sees it every load regardless of
//     that flag — until the GM mints them a character, the Overview is the thing
//     for them to read, so we keep surfacing it (a player with an assigned
//     character instead gets character creation via _maybeOpenCharacterCreation).
// The GM seeds the journal; SeedCompendiums grants players read access.
async function _openSettingOverview() {
	const overview = findVisibleJournal(SETTING_OVERVIEW_JOURNAL);
	if (!overview) return; // not seeded yet (or not visible to this user) — try again next load

	const needsOrientation = !game.user.isGM && !game.user.character;
	if (!needsOrientation && getSetting("settingOverviewShown")) return;

	overview.sheet.render(true);
	if (!getSetting("settingOverviewShown")) await setSetting("settingOverviewShown", true);
}

// Is a hotbar slot empty? The hotbar is a sparse map of slot → macro id, so an
// absent key means free. (`in` stringifies the slot, matching the string keys.)
function _isHotbarSlotFree(slot) {
	return !(slot in game.user.hotbar);
}

// The first empty hotbar slot at or after `from` (1–50, across all five pages), or
// null if the hotbar is somehow full. Lets us place a macro without evicting one
// the GM put in our default slot.
function _firstFreeHotbarSlot(from = 1) {
	for (let s = from; s <= 50; s++) if (_isHotbarSlotFree(s)) return s;
	return null;
}

// Find-or-create a global script macro and place it on the hotbar. Idempotent:
// refreshes the icon if it drifted, and only places the macro when it isn't already
// on the user's hotbar — so once it's placed, a manual rearrangement sticks. It
// takes its default `slot` only if that slot is free; otherwise it falls back to the
// first empty slot, so we never bump a macro the GM put there. The fixed system
// order is applied per layout version by _reorderSystemMacros. `match` overrides the
// default name-based lookup (the End of Session macro also keys on its command to
// avoid clashing with any user macro of the same name). Run these serially — each
// assignHotbarMacro writes the same user.hotbar document, so concurrent calls would
// clobber each other.
async function _ensureHotbarMacro({ name, img, command, slot, match }) {
	let macro = game.macros.find(match ?? (m => m.name === name));
	if (!macro) {
		macro = await Macro.create({ name, type: "script", img, command, scope: "global" });
	} else if (macro.img !== img) {
		await macro.update({ img });
	}

	const alreadySlotted = Object.values(game.user.hotbar).includes(macro.id);
	if (alreadySlotted) return;

	const target = _isHotbarSlotFree(slot) ? slot : _firstFreeHotbarSlot();
	if (target) await game.user.assignHotbarMacro(macro, target);
}

// Snap the system macros into their canonical order (1 Welcome · 2 Seasons Change ·
// 3 Run an Expedition · 4 Weather · 5 Die of Fate), then leave the arrangement alone
// so the GM is free to rearrange the hotbar. Guarded by a per-client layout version
// (the hotbar is per-user): it runs once per layout, so bumping _HOTBAR_LAYOUT_VERSION
// re-snaps everyone once (e.g. when Seasons Change was inserted) but later manual moves
// at the same version are left alone.
//
// Non-destructive: it never evicts a macro the GM placed in one of our slots. We
// first lift our own macros off the bar (freeing their slots), then re-place each at
// its canonical slot if free, else the first empty slot. So a personal macro sitting
// in slot 2 keeps its spot and ours flows around it.
async function _reorderSystemMacros() {
	if (getSetting("systemHotbarLayoutVersion") >= _HOTBAR_LAYOUT_VERSION) return;

	const macros = _SYSTEM_MACROS
		.map(o => ({ macro: game.macros.find(m => m.name === o.name && m.command === o.command), slot: o.slot }))
		.filter(o => o.macro);

	// Lift our macros off the hotbar so their canonical slots open up (a user macro
	// in one of those slots stays put). assignHotbarMacro(null, slot) clears a slot.
	for (const { macro } of macros) {
		const slot = Object.entries(game.user.hotbar).find(([, id]) => id === macro.id)?.[0];
		if (slot) await game.user.assignHotbarMacro(null, Number(slot));
	}

	// Re-place each at its canonical slot if free, else the first open slot.
	for (const { macro, slot } of macros) {
		const target = _isHotbarSlotFree(slot) ? slot : _firstFreeHotbarSlot();
		if (target) await game.user.assignHotbarMacro(macro, target);
	}

	await setSetting("systemHotbarLayoutVersion", _HOTBAR_LAYOUT_VERSION);
}

// Add the "(TEST ONLY) Populate World" script macro to the world's Macro Directory,
// inside a "For Testing Purposes" folder — but never to the hotbar (creating a Macro
// document doesn't slot it; only assignHotbarMacro does, which we deliberately skip).
// Its body is the
// create-test-characters dev script, fetched so that gitignored file stays the single
// source of truth: a missing file (a build that omits scripts/) skips silently, leaving
// real worlds untouched. Seeded once — a GM who deletes it keeps it gone — but while it
// exists its command is re-synced so edits to the script propagate. GM-only.
async function _ensureTestPopulateMacro() {
	let command;
	try {
		const res = await fetch(_TEST_MACRO_SRC);
		if (!res.ok) return;
		command = await res.text();
	} catch { return; }
	if (!command?.trim()) return;

	// Find-or-create the "For Testing Purposes" Macro folder the macro lives in.
	let folder = game.folders.find(f => f.type === "Macro" && f.name === _TEST_MACRO_FOLDER);
	if (!folder) folder = await Folder.create({ name: _TEST_MACRO_FOLDER, type: "Macro" });

	const existing = game.macros.find(m => m.name === _TEST_MACRO_NAME);
	if (existing) {
		const update = {};
		if (existing.command !== command) update.command = command;
		if (folder && existing.folder?.id !== folder.id) update.folder = folder.id;
		if (Object.keys(update).length) await existing.update(update);
		return;
	}
	if (getSetting("testPopulateMacroSeeded")) return; // deleted on purpose — leave it gone

	await Macro.create({ name: _TEST_MACRO_NAME, type: "script", img: _TEST_MACRO_IMG, command, scope: "global", folder: folder?.id ?? null });
	await setSetting("testPopulateMacroSeeded", true);
}

// Retire the standalone "Character Introductions" hotbar macro: its walkthrough
// now launches from the Welcome guide, so delete the system-created macro (which
// also clears its hotbar slot). No-op once done, so it's safe to run every load.
// (The Welcome macro re-homes itself: _ensureHotbarMacro now relocates any system
// macro that's pinned at the wrong slot.)
async function _retireIntroductionsMacro() {
	const intro = game.macros.find(m => m.name === _INTRO_MACRO_NAME && m.command === _INTRO_MACRO_SCRIPT);
	if (intro) await intro.delete();
}

async function _migrateArmourToArmor() {
	const staleActors = game.actors.filter(
		a => a.type === "character" && a.system?.attributes?.armour !== undefined
	);
	if (!staleActors.length) return;
	for (const actor of staleActors) {
		await actor.update({ "system.attributes.-=armour": null });
	}
}

async function _postStartupWelcomeMessageOnce() {
	if (getSetting("startupWelcomeShown")) return;
	if (!globalThis.ChatMessage?.create) return;
	await ChatMessage.create({
		content: _buildStartupWelcomeContent(),
		speaker: { alias: "Stonetop" },
	});
	await setSetting("startupWelcomeShown", true);
}

function _buildStartupWelcomeContent() {
	return `<section class="pbta-chat-card stonetop-roll-card stonetop-startup-card">
		<div class="cell cell--chat">
			<div class="chat-title row flexrow">
				<h2 class="cell__title">Welcome to <span class="stonetop-startup-card__title-logo">Stonetop</span></h2>
				<div class="cell__subtitle">Fresh-start helper</div>
			</div>
			<div class="stonetop-roll-card-description">
				<p>This is an unofficial Foundry VTT system for <strong>Stonetop</strong>, by Jeremy Strandberg, illustrated by Lucie Arnoux, with layout, editing, and co-design by Jason Lutes.</p>
			</div>
			<div class="card-content stonetop-startup-card__content">
				<div class="row stonetop-startup-card__section">
					<h3 class="cell__subtitle">Sheet Features</h3>
					<ul>
						<li>Guided character creation from the playbook picker.</li>
						<li>Edit mode for sheet setup, tab ordering, and character details.</li>
						<li>Clickable stat boxes, move dice, Basic Move chips, and Stonetop roll cards.</li>
						<li>Stonetop steading sheet with residents, player characters, seasons, resources, and improvements.</li>
						<li>End of Session macro added to the GM hotbar when available.</li>
					</ul>
				</div>
				<div class="row stonetop-startup-card__section">
					<h3 class="cell__subtitle">Useful Settings</h3>
					<ul>
						<li><span><strong>Sheet Font &amp; Size</strong>: choose the typeface and scale the text on Stonetop sheets.</span></li>
						<li><span><strong>On Hover Info</strong>: turn all hover info on/off, or tune Stats, Basic Moves, Playbook Moves, Traits, and Gear Tags individually.</span></li>
					</ul>
				</div>
				<div class="row stonetop-startup-card__section">
					<h3 class="cell__subtitle">Recommended Add-on</h3>
					<ul>
						<li><span>Install <strong><a href="https://foundryvtt.com/packages/dice-so-nice">Dice So Nice!</a></strong> for 3D dice on the tabletop &mdash; every move, damage, and steading roll uses Foundry's dice, so it adds a little immersion to your rolls.</span></li>
					</ul>
				</div>
			</div>
			<div class="row stonetop-startup-card__actions">
				<button type="button" class="stonetop-startup-open-welcome">
					<i class="fas fa-feather"></i> Open the First-Session Guide
				</button>
			</div>
			<div class="row row--border stonetop-startup-card__footer">
				Open <strong>Configure Settings</strong> and filter for <strong>Stonetop</strong> to adjust these options.
			</div>
		</div>
	</section>`;
}
