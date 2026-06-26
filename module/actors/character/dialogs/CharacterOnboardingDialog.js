// Descriptions for animal companion trait tags — checked before compendium lookup.
import { isMajorArcana } from "../../../arcana-icons.js";
import { parseMovePickCount, allowedMarkableActions } from "../StonetopCharacter.js";
import { markQuestionBullets } from "../../../utils/question-bullets.js";
import { FrontOnOpen, openJournalSheetAsChild } from "../../../utils/front-on-open.js";
import { shuffle } from "../../../utils/arrays.js";
import { normalizePlaybookGlyphs, composeInstinct, parseInstinct } from "../../../utils/strings.js";
import { wrapStonetopGlyphsInEl } from "../../../utils/glyphs.js";
import { enrichMoveRefsInEl } from "../../../utils/move-refs.js";
import { faqForStep, faqPage } from "../../../utils/onboarding-faq.js";
import { markFaqItems } from "../../../utils/faq-bullets.js";
import { applyGearTermTooltips } from "../../../utils/gear-term-tooltips.js";
import { StonetopAutocomplete } from "../../../utils/autocomplete.js";
import { wellVersedTopicSummary } from "./well-versed-topics.js";
import { LORE_TERM_TOOLTIPS } from "../../../utils/lore-terms.js";
import { moveGroupsForPlaybook, moveGroupKeys } from "./onboarding-move-groups.js";
import { playbookIconPath } from "../../../utils/playbook-actors.js";

const SEEKER_ARCANA_SLUGS = ["collection", "arcana-major", "arcana-minor"];

// The Ranger's animal-companion builder only applies to characters who have the
// Animal Companion move (Beast-Bonded background or a free-pick choice).
const ANIMAL_COMPANION_MOVE = "Animal Companion";

const STEADING_NPC_TRAITS = [
	"all thumbs", "ambitious", "beloved by everyone", "beautiful singing voice",
	"best cook", "best weaver", "blind", "braved the Ruined Tower", "cautious",
	"cheery", "chronic cough", "complains too much", "cowardly", "craves recognition",
	"curious", "dallied with the Fae years ago", "deaf", "desperately wants a child",
	"distills the best whisky", "doesn't pull their weight", "drunkard", "eagle-eye",
	"fearless", "foundling", "gathers herbs from the Wood", "gets the best deals",
	"gifted storyteller", "gods-fearing", "good with children", "happy-go-lucky",
	"has a beef with Marshedge", "has a good heart", "has a lot of backbone",
	"has a wandering eye", "has a way with animals", "has Fae blood in their veins",
	"has just terrible luck", "has lost their nerve", "has no respect for their elders",
	"has terrible nightmares", "has the most children", "has their head in the clouds",
	"hates the Hillfolk", "hears voices", "humorless", "immaculate appearance",
	"jealous", "just got married", "keeps to themselves", "knows all the gossip",
	"lame", "likes to hurt things", "lived among the Forest Folk", "lost all their children",
	"lovesick", "loves their dogs", "loyal friend", "most handsome", "moved here recently",
	"must approve any marriages", "mute", "not afraid of deep water", "not too bright",
	"oldest orphan", "overprotective", "prettiest", "prideful", "reckless",
	"refuses to marry", "resents their lot in life", "runs everywhere", "sensitive",
	"simpleton", "slew many crinwin", "stoic", "stubborn", "suffers from fits",
	"swears they met the Pale Hunter", "tells the best jokes", "tender-hearted",
	"tends the Gods' Pavilion", "tends to the sick & injured", "touched", "very strong",
	"wants to have kids", "well-read", "well-traveled", "widowed", "will eat anything",
];

export const ANIMAL_COMPANION_TRAIT_GLOSSARY = {
	"agile":           "Acts with grace and nimbleness; can slip through tight spaces and dodge with ease.",
	"adorable":        "Disarmingly cute; people are more likely to be charmed than threatened.",
	"aggressive":      "Attacks first, asks questions later; prone to charging into danger.",
	"annoying":        "Tends to make noise, steal food, or cause minor mischief at the worst times.",
	"attack-bird":     "Can dive and slash at a target's face or eyes with surprising ferocity.",
	"beautiful":       "Striking appearance that draws attention and admiration.",
	"burrowing":       "Can dig through earth and loose soil to move underground or escape confinement.",
	"calm":            "Unflappable under pressure; rarely startled or panicked.",
	"cautious":        "Won't take unnecessary risks; hangs back until a course of action is clear.",
	"clever":          "Understands complex commands and can solve simple problems on its own.",
	"climber":         "At home scaling trees, cliffs, or walls; rarely stopped by vertical obstacles.",
	"dextrous":        "Nimble with its paws or hands; can manipulate objects and work simple latches.",
	"easy-going":      "Laid-back and even-tempered; gets along with just about everyone.",
	"enduring":        "Can sustain strenuous effort far longer than expected without flagging.",
	"fast":            "Moves quickly over open ground; can outrun most threats without difficulty.",
	"fierce":          "Attacks with aggression and doesn't back down; enemies take it seriously.",
	"gluttonous":      "Compelled to eat whenever food is present; can be distracted or baited with it.",
	"hardy":           "Handles harsh weather, rough terrain, and lean times without complaint.",
	"keen-eared":      "Exceptional hearing; detects sounds long before others notice them.",
	"keen-eyed":       "Exceptional eyesight; spots movement and detail at great distances.",
	"keen-nosed":      "Exceptional sense of smell; can track by scent and detect hidden creatures or objects.",
	"large":           "Bigger than a typical member of its kind; harder to ignore, easier to spot.",
	"mimic":           "Can reproduce sounds it has heard, including voices and environmental noises.",
	"pack-hunter":     "Coordinates naturally with allies; gains an edge when acting alongside others.",
	"patient":         "Waits calmly for exactly the right moment before striking or acting.",
	"powerful":        "Exceptional strength; can haul heavy loads or force its way through barriers.",
	"protective":      "Will place itself between danger and its allies, even at personal risk.",
	"quick":           "Fast reflexes; acts before most opponents have a chance to respond.",
	"sharp-eyed":      "Keen sight; consistently spots things that others overlook.",
	"stealthy":        "Moves silently and stays out of sight; excellent at following without being detected.",
	"stinky":          "Produces a strong, unpleasant odor that deters predators and ruins a good meal.",
	"swift":           "Exceptionally fast; outpaces almost anything in a straight run.",
	"terrifying":      "Its presence alone frightens enemies; the cowardly may flee at the sight of it.",
	"thieving":        "Inclined to snatch shiny objects, food, or anything left unattended.",
	"tiny":            "Small enough to go unnoticed or squeeze through impossibly tight gaps.",
	"tireless":        "Doesn't fatigue from sustained effort; keeps going long after others would quit.",
	"tough":           "Resilient and hard to hurt; shrugs off blows that would fell lesser creatures.",
};

export class CharacterOnboardingDialog extends Application {
	static hasIncompleteQuestions(playbookDoc, initialSelections = null) {
		const d = Object.create(CharacterOnboardingDialog.prototype);
		d._initializeState(playbookDoc, initialSelections, null);
		return d._steps.some(s => d._isResumeQuestionStep(s) && !d._isStepAnsweredForResume(s));
	}

	static questionCompletionDiagnostics(playbookDoc, initialSelections = null) {
		const diagnostic = Object.create(CharacterOnboardingDialog.prototype);
		diagnostic._initializeState(playbookDoc, initialSelections, "first-incomplete");
		return diagnostic.getQuestionCompletionDiagnostics();
	}

	constructor(playbookDoc, onComplete, options = {}) {
		const { onBack, onSave, onClose, onProgress, onLiveSave, onExit, initialSelections, startAtStep = null, ...appOptions } = options;
		super(appOptions);
		this._playbookDoc        = playbookDoc;
		this._onComplete         = onComplete;
		this._onBack             = onBack ?? null;
		this._onSave             = onSave ?? null;
		// Fired when the dialog closes for good (finish / save-and-close / window X),
		// but NOT on back-navigation to the picker (see _goBack). The first-session
		// flow uses it to open the player's sheet once they're done.
		this._onClose            = onClose ?? null;
		// Reports the player's live position (current step index, total steps) each
		// time the page changes, so the GM's first-session roster can show how far
		// along they are. Null outside the guided creation/resume flow.
		this._onProgress         = onProgress ?? null;
		// Cheap, frequent autosave of the current page's answers (debounced, on every
		// edit) so written content survives a reload. Kept separate from onProgress
		// because it must NOT hit the database/network on every keystroke.
		this._onLiveSave         = onLiveSave ?? null;
		// Fired when the player closes onboarding without finishing it (window X or
		// save-and-close), but NOT on completion or back-navigation — lets the roster
		// show that they stepped away mid-creation.
		this._onExit             = onExit ?? null;
		// Pre-seed cache with glossaries so getData() and _lookupWord share one lookup path.
		this._wordCache = new Map([
			...Object.entries(ANIMAL_COMPANION_TRAIT_GLOSSARY),
			...Object.entries(LORE_TERM_TOOLTIPS),
		]);
		this._hoveredAnchor = null;
		this._frontOnOpen = new FrontOnOpen(this);

		this._initializeState(playbookDoc, initialSelections, startAtStep);
	}

	_initializeState(playbookDoc, initialSelections = null, startAtStep = null) {
		this._playbookDoc = playbookDoc;
		const f = playbookDoc.flags?.stonetop ?? {};
		this._backgrounds        = f.backgrounds        ?? [];
		this._rawInstincts       = f.instincts           ?? [];
		this._rawAppearance      = f.appearance          ?? [];
		this._origins            = f.origin              ?? [];
		this._rawPossessions     = f.specialPossessions  ?? null;
		this._rawInvocations     = f.invocations         ?? null;
		this._rawCrew            = f.crew                ?? null;
		this._rawAnimalCompanion = f.animalCompanion     ?? null;
		this._rawLore            = f.lore               ?? [];
		this._rawMoveChoices     = f.moves?.choices      ?? [];
		this._movePickCount  = this._parseMovePickCount();
		this._movesCache              = null;
		this._arcanaCache             = null;
		this._arcanaCachePromise      = null;
		this._combineSeekerArcana     = this._shouldCombineSeekerArcana();
		this._statScores     = this._parseStatScores();
		this._statPoolCount  = {};
		for (const v of this._statScores) this._statPoolCount[v] = (this._statPoolCount[v] ?? 0) + 1;

		// _selections must be initialized before _buildSteps(), which calls
		// _getInitiatesData() and reads this._selections.backgroundSlug.
		this._selections = {
			backgroundSlug:  "",
			instinctValue:   "",
			appearance:      {},
			originRegion:    "",
			name:            "",
			stats:           { str: null, dex: null, con: null, int: null, wis: null, cha: null },
			possessions:     [],
			// A single write-in "something else (discuss with GM)" possession. When
			// non-empty it spends a pick like any listed option (Book I p.20: keep it
			// setting-appropriate and on par with the other options).
			customPossession: "",
			// Sub-choices for possessions that bundle a "pick N from this list" set
			// (e.g. the Heavy's & Marshal's Weapons of war): possessionSlug → chosen
			// sub-slugs. Mirrors the actor's possessions.subChoices flag shape.
			possessionChoices: {},
			moves:           [],
			// "Either X OR Y" starting-move picks, keyed by choice-group index → the
			// chosen move's compendium id (e.g. the Heavy's Armored OR Uncanny Reflexes).
			moveChoices:     {},
			invocations:     [],
			initiates:       [],
			initiateDetails: {},
			crew:            { name: "", tags: [], instinct: "", cost: "" },
			animalCompanion: { type: "", kind: "", traits: [], name: "", instinct: "", cost: "" },
			lore:            { picks: {}, texts: {} },
			arcana:          { major: "", minorDraw: [], minorRoles: { mastered: "", found: "", lead: "" } },
			backgroundChoices: {},
			backgroundSetup: { choices: {}, texts: {}, neighborTraits: {}, neighborPicks: {} },
			// Slugs of the background's level-gated markable actions marked during
			// creation (the Ranger's Beast-Bonded "focus on your companion" actions —
			// mark 1 at 1st level). Mirrors flags.stonetop.background.markedActions.
			markedActions: [],
		};

		if (initialSelections) {
			foundry.utils.mergeObject(this._selections, initialSelections, { inplace: true });
		}

		this._ensureBackgroundMoveChoices();
		this._ensureBackgroundSetup();
		this._ensureBackgroundActions();
		this._steps = this._buildSteps();
		this._step = startAtStep === "first-incomplete"
			? this._firstIncompleteStepIndex()
			: Math.max(0, this._steps.indexOf(startAtStep ?? ""));
	}

	// ── Step management ───────────────────────────────────────────────

	_buildSteps() {
		const steps = [];
		const combineSeekerArcana = this._combineSeekerArcana;
		if (this._backgrounds.length)   steps.push("background");
		if (this._rawInstincts.length)  steps.push("instinct");
		if (this._rawAppearance.length) steps.push("appearance");
		if (this._origins.length)       steps.push("origin");
		steps.push("stats");
		if ((this._rawPossessions?.pickCount ?? 0) > 0 && this._rawPossessions?.options?.length) {
			steps.push("possession");
		}
		if (this._movePickCount > 0 || this._rawMoveChoices.length) steps.push("moves");
		// Insert steps
		if ((this._rawInvocations?.startingCount ?? 0) > 0 && this._rawInvocations?.options?.length) {
			steps.push("invocations");
		}
		if (this._getInitiatesData()) steps.push("initiates");
		if (this._rawCrew?.availableTags?.length)          steps.push("crew");
		if (this._rawAnimalCompanion?.types?.length && this._animalCompanionMoveSelected()) {
			steps.push("animalCompanion");
		}
		if (combineSeekerArcana) { steps.push("seekerArcana"); steps.push("seekerArcanaMinor"); }
		for (let i = 0; i < this._rawLore.length; i++) {
			if (combineSeekerArcana && this._isSeekerArcanaSection(this._rawLore[i])) continue;
			// An option-less section has nothing to select, so on its own it renders as
			// a dead-end page — whether a bare header (the Heavy's "A History of
			// Violence") or an intro with flavor prose (the Lightbearer's "Praise the
			// Day"). Skip its own step and fold its title (and any prose) onto the
			// selection pages that follow it (see _loreGroupHeading / _loreGroupIntro),
			// keeping the `lore:${i}` index scheme intact. Only fold it when a later
			// selectable section can actually absorb it; a trailing header with nothing
			// after it keeps its own step so its title/prose isn't lost.
			if (this._isLoreFoldedHeader(this._rawLore[i]) && this._hasFollowingSelectableLore(i)) continue;
			steps.push(`lore:${i}`);
		}
		return steps;
	}

	// Rebuild steps when a selection changes which conditional steps appear
	// (e.g. picking Initiate background adds the initiates step).
	_rebuildDynamicSteps() {
		const currentType = this._steps[this._step];
		this._steps = this._buildSteps();
		// If the animal-companion step just dropped out (the move was unpicked or the
		// granting background changed), discard any companion built earlier so the
		// finished character doesn't keep a companion it no longer has the move for.
		if (!this._steps.includes("animalCompanion") && this._selections.animalCompanion.type) {
			this._selections.animalCompanion = { type: "", kind: "", traits: [], name: "", instinct: "", cost: "" };
		}
		const newIdx = this._steps.indexOf(currentType);
		this._step = newIdx >= 0 ? newIdx : Math.min(this._step, this._steps.length - 1);
	}

	// Whether the character has (or will have) the Animal Companion move: a
	// background that grants it (the Ranger's Beast-Bonded) or a free-pick choice.
	// The free-pick check needs the move list, so it only resolves once the moves
	// step has loaded it (eagerly preloaded in _render for companion playbooks);
	// the Beast-Bonded path works without it.
	_animalCompanionMoveSelected() {
		const bg = this._selectedBackground();
		if ((bg?.moves ?? []).includes(ANIMAL_COMPANION_MOVE)) return true;
		const chosen = new Set(this._selections.moves);
		return (this._movesCache ?? []).some(doc => chosen.has(doc.id) && doc.name === ANIMAL_COMPANION_MOVE);
	}

	// Returns the Initiate background's choices object when the Initiate
	// background is selected; null otherwise.
	_getInitiatesData() {
		if (this._selections.backgroundSlug !== "initiate") return null;
		const bg = this._backgrounds.find(b => b.slug === "initiate");
		return bg?.choices?.options?.length ? bg.choices : null;
	}

	// Normalize the choices.count array into [min, max] with safe defaults.
	_initiatesCountRange(choices) {
		const arr = choices?.count;
		if (!arr?.length) return [2, 3];
		return [Math.min(...arr), Math.max(...arr)];
	}

	// ── Move helpers ──────────────────────────────────────────────────

	_isGordinsDelve(region) {
		return String(region ?? "").toLowerCase().includes("gordin");
	}

	_originNameGroups() {
		return this._origins
			.filter(o => !this._isGordinsDelve(o.region) && o.names?.length)
			.map(o => ({ region: o.region, names: o.names }));
	}

	_appearanceLineLabel(options, lineIdx) {
		const text = options.map(o => String(o ?? "").toLowerCase()).join(" ");
		if (text.includes("voice") || text.includes("spoken")) return "Voice";
		if (/(robe|clothes|cloak|gear|fur|leather|groomed|shaggy|threadbare|polish|badge)/.test(text)) return "Garb";
		if (/(body|frame|curvy|strapping|thin|solid|willowy|lithe|heavyset|gangly|ripped|stocky|wiry|compact|lean|wolfish|bony|limbed|big|scrawny|sinewy|slender|thick)/.test(text)) return "Build";
		if (/(scar|nose|missing|fingers|hands|frown|jaw|smirk|eyes|back)/.test(text)) return "Feature";
		if (/(step|stride|strut)/.test(text)) return "Bearing";
		return lineIdx === 0 ? "Appearance" : "Look";
	}

	_normalizeOnboardingText(value) {
		return normalizePlaybookGlyphs(value);
	}

	_parseMovePickCount() {
		return parseMovePickCount(this._playbookDoc.flags?.stonetop?.moves?.startingMovesNote);
	}

	_parseLorePickMax(section) {
		const desc = String(section?.description ?? "").toLowerCase();
		if (/answer\s+at\s+least/.test(desc)) return Infinity;
		// "choose N–M" / "choose N-M" (en-dash U+2013 or regular hyphen)
		const rangeM = desc.match(/(?:choose|pick)\s+(\d+)\s*[–\-]\s*(\d+)/);
		if (rangeM) return parseInt(rangeM[2]);
		// "choose N or M"
		const orM = desc.match(/(?:choose|pick)\s+(\d+)\s+or\s+(\d+)/);
		if (orM) return parseInt(orM[2]);
		// "choose N, maybe M"
		const maybeM = desc.match(/(?:choose|pick)\s+(\d+)[,\s]+maybe\s+(\d+)/);
		if (maybeM) return parseInt(maybeM[2]);
		// "choose N"
		const singleM = desc.match(/(?:choose|pick)\s+(\d+)/);
		if (singleM) return parseInt(singleM[1]);
		// fallback: if all options are pick-type with max 1, assume pick 1
		const opts = section?.options ?? [];
		if (opts.length > 0 && opts.every(o => !o.type && (o.max ?? 1) === 1)) return 1;
		return Infinity;
	}

	_countLoreSectionPicks(sectionSlug) {
		let n = 0;
		for (const [key, val] of Object.entries(this._selections.lore.picks)) {
			if (key.startsWith(`${sectionSlug}:`) && val > 0) n++;
		}
		return n;
	}

	_isSeekerArcanaSection(section) {
		return SEEKER_ARCANA_SLUGS.includes(section?.slug);
	}

	_shouldCombineSeekerArcana() {
		const slugs = new Set(this._rawLore.map(section => section.slug));
		return SEEKER_ARCANA_SLUGS.every(slug => slugs.has(slug));
	}

	_applyBackgroundChange(slug) {
		this._selections.backgroundSlug = slug;
		this._selections.initiates = [];
		this._ensureBackgroundMoveChoices();
		this._ensureBackgroundSetup();
		this._ensureBackgroundActions();
		this._ensureSeekerMajorSelection();
		this._rebuildDynamicSteps();
	}

	// Drop any marked actions that don't belong to the current background's list
	// (and clear them entirely when the background has no markable actions).
	_ensureBackgroundActions(background = this._selectedBackground()) {
		const markable = background?.markableActions;
		if (!markable?.options?.length) {
			this._selections.markedActions = [];
			return;
		}
		const allowed = new Set(markable.options.map(o => o.slug));
		this._selections.markedActions = this._selections.markedActions.filter(s => allowed.has(s));
	}

	// Whether the player has marked the required number of actions at creation
	// (Beast-Bonded must mark 1 at 1st level). True when the background has none.
	_backgroundActionsComplete(background = this._selectedBackground()) {
		const markable = background?.markableActions;
		if (!markable?.options?.length) return true;
		return this._selections.markedActions.length >= allowedMarkableActions(markable, 1);
	}

	// Render-data for the background's level-gated markable actions (Beast-Bonded),
	// or null when it has none. Onboarding is always 1st level, so `allowed` is the
	// number of marks unlocked at level 1 (1 for Beast-Bonded).
	_backgroundMarkableActionsData(background) {
		const markable = background?.markableActions;
		if (!markable?.options?.length) return null;
		const allowed = allowedMarkableActions(markable, 1);
		const marked  = new Set(this._selections.markedActions);
		const markedCount = markable.options.filter(o => marked.has(o.slug)).length;
		const atLimit = markedCount >= allowed;
		return {
			backgroundSlug: background.slug,
			label:          this._normalizeOnboardingText(markable.label ?? ""),
			allowed,
			markedCount,
			options: markable.options.map(o => {
				const isSelected = marked.has(o.slug);
				return {
					backgroundSlug: background.slug,
					slug:       o.slug,
					label:      this._normalizeOnboardingText(o.label),
					isSelected,
					disabled:   !isSelected && atLimit,
				};
			}),
		};
	}

	_selectedBackground() {
		return this._backgrounds.find(bg => bg.slug === this._selections.backgroundSlug) ?? null;
	}

	_backgroundMoveChoices(background = this._selectedBackground()) {
		return background?.moveChoices ?? [];
	}

	_moveChoiceKey(choice) {
		return choice?.move ?? choice?.slug ?? choice?.label ?? "";
	}

	_ensureBackgroundMoveChoices(background = this._selectedBackground()) {
		if (!background) return;
		for (const choice of this._backgroundMoveChoices(background)) {
			const key = this._moveChoiceKey(choice);
			if (!key) continue;
			if (choice.value) {
				this._selections.backgroundChoices[key] = {
					label: choice.label ?? key,
					value: choice.value,
				};
				continue;
			}
			const allowed = choice.options ?? [];
			const saved = this._selections.backgroundChoices[key]?.value ?? "";
			if (!allowed.includes(saved)) {
				this._selections.backgroundChoices[key] = {
					label: choice.label ?? key,
					value: "",
				};
			}
		}
	}

	_backgroundMoveChoiceData(background) {
		return this._backgroundMoveChoices(background).map(choice => {
			const key = this._moveChoiceKey(choice);
			const selectedValue = this._selections.backgroundChoices[key]?.value ?? choice.value ?? "";
			return {
				key,
				move: choice.move ?? key,
				label: this._normalizeOnboardingText(choice.label ?? key),
				value: this._normalizeOnboardingText(choice.value ?? ""),
				// Player-safe "known by most in Stonetop" summary for the granted topic,
				// shown on hover so a new player knows what e.g. "the Things Below" means.
				valueTopicSummary: wellVersedTopicSummary(choice.value) ?? "",
				hasOptions: !!choice.options?.length,
				options: (choice.options ?? []).map(value => ({
					value,
					label: this._normalizeOnboardingText(value),
					selected: selectedValue === value,
					topicSummary: wellVersedTopicSummary(value) ?? "",
				})),
			};
		});
	}

	_backgroundSetup(background = this._selectedBackground()) {
		return background?.setup ?? null;
	}

	_ensureBackgroundSetup(background = this._selectedBackground()) {
		const setup = this._backgroundSetup(background);
		if (!setup) return;
		for (const choice of (setup.choices ?? [])) {
			const key = choice.key;
			if (!key) continue;
			const allowed = new Set((choice.options ?? []).map(o => o.value));
			if (!allowed.has(this._selections.backgroundSetup.choices[key])) {
				this._selections.backgroundSetup.choices[key] = "";
			}
		}
		for (const text of (setup.texts ?? [])) {
			const key = text.key;
			if (key && this._selections.backgroundSetup.texts[key] === undefined) {
				this._selections.backgroundSetup.texts[key] = "";
			}
		}
		for (const neighbor of (setup.neighbors ?? [])) {
			const key = neighbor.traitKey;
			if (key && this._selections.backgroundSetup.neighborTraits[key] === undefined) {
				this._selections.backgroundSetup.neighborTraits[key] = "";
			}
		}
		for (const choice of (setup.neighborChoices ?? [])) {
			const key = choice.key;
			if (!key) continue;
			const allowed = new Set((choice.options ?? []).map(o => o.value));
			const current = this._selections.backgroundSetup.neighborPicks[key] ?? [];
			this._selections.backgroundSetup.neighborPicks[key] = current.filter(value => allowed.has(value));
		}
	}

	_backgroundSetupData(background) {
		const setup = this._backgroundSetup(background);
		if (!setup) return null;
		const choices = (setup.choices ?? []).map(choice => ({
			key: choice.key,
			label: this._normalizeOnboardingText(choice.label ?? choice.key),
			apply: choice.apply ?? "",
			options: (choice.options ?? []).map(option => ({
				value: option.value,
				label: this._normalizeOnboardingText(option.label ?? option.value),
				selected: this._selections.backgroundSetup.choices[choice.key] === option.value,
			})),
		}));
		const texts = (setup.texts ?? []).map(text => ({
			key: text.key,
			label: this._normalizeOnboardingText(text.label ?? text.key),
			placeholder: this._normalizeOnboardingText(text.placeholder ?? ""),
			value: this._selections.backgroundSetup.texts[text.key] ?? "",
		}));
		// The trait field is a free-type combo: a plain input whose suggestions come
		// from our own scrollable popup (_attachTraitAutocomplete, fed STEADING_NPC_TRAITS).
		const neighbors = (setup.neighbors ?? []).map(neighbor => ({
			name: this._normalizeOnboardingText(neighbor.name ?? ""),
			origin: this._normalizeOnboardingText(neighbor.origin ?? ""),
			backgroundSlug: background.slug,
			traitKey: neighbor.traitKey ?? "",
			traitLabel: this._normalizeOnboardingText(neighbor.traitLabel ?? "Trait"),
			trait: this._selections.backgroundSetup.neighborTraits[neighbor.traitKey] ?? "",
		}));
		const neighborChoices = (setup.neighborChoices ?? []).map(choice => {
			const selected = this._selections.backgroundSetup.neighborPicks[choice.key] ?? [];
			return {
				key: choice.key,
				label: this._normalizeOnboardingText(choice.label ?? choice.key),
				count: Number(choice.count ?? 1),
				selectedCount: selected.length,
				options: (choice.options ?? []).map(option => ({
					value: option.value,
					name: this._normalizeOnboardingText(option.name ?? option.value),
					origin: this._normalizeOnboardingText(option.origin ?? ""),
					trait: this._normalizeOnboardingText(option.trait ?? ""),
					selected: selected.includes(option.value),
				})),
			};
		});
		return choices.length || texts.length || neighbors.length || neighborChoices.length
			? { choices, texts, neighbors, neighborChoices }
			: null;
	}

	_seekerMajorArcanaSlugs(background = this._selectedBackground()) {
		return background?.majorArcana ?? [];
	}

	_ensureSeekerMajorSelection() {
		if (!this._combineSeekerArcana) return;
		const allowed = this._seekerMajorArcanaSlugs();
		if (!allowed.length) return;
		if (!allowed.includes(this._selections.arcana.major)) {
			this._selections.arcana.major = allowed[0];
		}
	}

	_drawSeekerMinorArcana(minorOptions) {
		this._selections.arcana.minorDraw = shuffle(minorOptions.map(option => option.slug)).slice(0, 3);
		this._selections.arcana.minorRoles = { mastered: "", found: "", lead: "" };
	}

	_ensureSeekerMinorDraw(minorOptions) {
		const available = new Set(minorOptions.map(option => option.slug));
		const current = this._selections.arcana.minorDraw.filter(slug => available.has(slug));
		if (current.length === 3) return;
		this._drawSeekerMinorArcana(minorOptions);
	}

	// A lore section with no options has nothing to select, so it shouldn't get its
	// own onboarding page. Instead it folds onto the selection pages that follow it,
	// whether it's a bare group header (the Heavy's "A History of Violence") or an
	// intro carrying flavor prose (the Lightbearer's "Praise the Day").
	_isLoreFoldedHeader(section) {
		return !!section && (section.options?.length ?? 0) === 0;
	}

	// Whether a selectable lore section follows `index` to fold a header's title/prose
	// onto. A header with no such section after it must keep its own step instead of
	// folding into nothing. Mirrors _buildSteps' seeker-arcana skip so a combined
	// arcana section (which becomes its own non-lore step) doesn't count as a target.
	_hasFollowingSelectableLore(index) {
		for (let j = index + 1; j < this._rawLore.length; j++) {
			if (this._combineSeekerArcana && this._isSeekerArcanaSection(this._rawLore[j])) continue;
			if (!this._isLoreFoldedHeader(this._rawLore[j])) return true;
		}
		return false;
	}

	// Index of the nearest folded header preceding `index` — the umbrella the section
	// sits under — or -1 when the section isn't part of such a group.
	_nearestFoldedHeaderIndex(index) {
		for (let i = index - 1; i >= 0; i--) {
			if (this._isLoreFoldedHeader(this._rawLore[i])) return i;
		}
		return -1;
	}

	// The umbrella heading a lore section sits under: the title of the nearest
	// preceding folded header (e.g. "A History of Violence" above the Heavy's three
	// pick-lists). Empty when the section isn't part of such a group.
	_loreGroupHeading(index) {
		const headerIdx = this._nearestFoldedHeaderIndex(index);
		if (headerIdx < 0) return "";
		return this._normalizeOnboardingText(this._rawLore[headerIdx].title ?? "");
	}

	// The folded header's intro prose, shown once — on the first selection page under
	// the umbrella — so flavor like the Lightbearer's "You are the appointed servant
	// of Helior…" survives without a dead-end page. Empty on later pages in the group
	// and when the header carried no prose (e.g. the Heavy's bare title).
	_loreGroupIntro(index) {
		const headerIdx = this._nearestFoldedHeaderIndex(index);
		if (headerIdx < 0) return "";
		// Only the first selectable page after the header carries the intro: if any
		// selectable section sits between the header and this one, it already showed it.
		for (let j = headerIdx + 1; j < index; j++) {
			if (!this._isLoreFoldedHeader(this._rawLore[j])) return "";
		}
		return this._normalizeOnboardingText(this._rawLore[headerIdx].description ?? "");
	}

	_loreSectionData(section, index = this._rawLore.indexOf(section)) {
		const opts          = section.options ?? [];
		const isTextSection = opts.length > 0 && opts.every(o => o.type === "text");
		const isPickSection = opts.length > 0 && !isTextSection;
		const { picks, texts } = this._selections.lore;
		const previousSection = index > 0 ? this._rawLore[index - 1] : null;
		const previousSelectedOptions = isTextSection && previousSection
			? (previousSection.options ?? [])
				.filter(opt => (picks[`${previousSection.slug}:${opt.slug}`] ?? 0) > 0)
				.map(opt => this._normalizeOnboardingText(opt.description ?? ""))
				.filter(Boolean)
			: [];
		const pickMax      = isPickSection ? this._parseLorePickMax(section) : Infinity;
		const selectedPickCount = isPickSection ? this._countLoreSectionPicks(section.slug) : 0;
		const atLimit      = pickMax < Infinity && selectedPickCount >= pickMax;
		return {
			sectionSlug:        section.slug,
			title:              this._normalizeOnboardingText(section.title ?? ""),
			groupHeading:       this._loreGroupHeading(index),
			groupIntro:         this._loreGroupIntro(index),
			description:        this._normalizeOnboardingText(section.description ?? ""),
			contextTitle:        previousSelectedOptions.length ? this._normalizeOnboardingText(previousSection.title ?? "") : "",
			contextAnswers:      previousSelectedOptions,
			isPickSection,
			isTextSection,
			hasOptions:         opts.length > 0,
			pickMax:            pickMax === Infinity ? null : pickMax,
			selectedPickCount,
			options: opts.map(opt => {
				if (opt.type === "text") {
					return {
						slug:        opt.slug,
						sectionSlug: section.slug,
						description: this._normalizeOnboardingText(opt.description ?? ""),
						type:        "text",
						value:       texts[`${section.slug}:${opt.slug}`] ?? "",
					};
				}
				const key   = `${section.slug}:${opt.slug}`;
				const count = picks[key] ?? 0;
				return {
					slug:        opt.slug,
					sectionSlug: section.slug,
					description: this._normalizeOnboardingText(opt.description ?? ""),
					type:        "pick",
					max:         opt.max ?? 1,
					count,
					isSelected:  count > 0,
					disabled:    !count && atLimit,
				};
			}),
		};
	}

	_firstParagraph(html) {
		const div = document.createElement("div");
		div.innerHTML = String(html ?? "");
		const p = div.querySelector("p");
		// If no <p> found, fall back to first non-empty line rather than the whole text.
		const raw = p
			? p.textContent
			: (div.textContent.split(/\n+/).find(l => l.trim()) ?? div.textContent);
		return this._normalizeOnboardingText(raw.trim());
	}

	_animalCompanionKindOptions(typeData) {
		const examples = this._normalizeOnboardingText(typeData?.examples ?? "")
			.replace(/[.…]+$/g, "");
		return examples
			.split(",")
			.map(value => value.trim())
			.filter(Boolean);
	}

	async _loadArcanaOptions() {
		if (this._arcanaCache) return this._arcanaCache;
		if (this._arcanaCachePromise) return this._arcanaCachePromise;
		this._arcanaCachePromise = (async () => {
			const pack = game.packs.get("stonetop.stonetop-items");
			if (!pack) return { major: [], minor: [] };
			await pack.getIndex({ fields: ["system.moveType"] });
			const entries = pack.index.filter(entry => entry.system?.moveType === "arcanum");
			const docs = await Promise.all(entries.map(entry => pack.getDocument(entry._id)));
			const options = docs.filter(Boolean).flatMap(doc => {
				const flags = doc.flags?.stonetop ?? {};
				const slug  = flags.slug;
				if (!slug) return [];
				return [{
					slug,
					name:        this._normalizeOnboardingText(doc.name ?? flags.front?.title ?? slug),
					description: this._firstParagraph(flags.front?.description ?? ""),
					img:         doc.img && doc.img !== "icons/svg/item-bag.svg" ? doc.img : null,
					isMajor:     isMajorArcana(slug),
				}];
			});
			this._arcanaCache = {
				major: options.filter(o => o.isMajor).sort((a, b) => a.name.localeCompare(b.name)),
				minor: options.filter(o => !o.isMajor).sort((a, b) => a.name.localeCompare(b.name)),
			};
			return this._arcanaCache;
		})();
		return this._arcanaCachePromise;
	}

	async _seekerArcanaChoiceData() {
		const arcana = await this._loadArcanaOptions();
		this._ensureSeekerMajorSelection();
		this._ensureSeekerMinorDraw(arcana.minor);
		const selectedMajor = this._selections.arcana.major;
		const allowedMajor = new Set(this._seekerMajorArcanaSlugs());
		const minorDraw = new Set(this._selections.arcana.minorDraw);
		const { minorRoles } = this._selections.arcana;
		return {
			majorSelected: selectedMajor,
			minorAssignedCount: Object.values(minorRoles).filter(Boolean).length,
			minorPickCount: this._selections.arcana.minorDraw.length,
			major: arcana.major.filter(option => allowedMajor.has(option.slug)).map(option => ({
				...option,
				selected: option.slug === selectedMajor,
			})),
			minor: arcana.minor.filter(option => minorDraw.has(option.slug)).map(option => ({
				...option,
				role: Object.entries(minorRoles).find(([, slug]) => slug === option.slug)?.[0] ?? "",
				})),
		};
	}

	async _loadPlaybookMoves() {
		const pack = game.packs.get("stonetop.stonetop-items");
		if (!pack) return [];
		await pack.getIndex({ fields: ["system.playbook", "system.isStartingMove", "system.requirement"] });
		const relevant = pack.index.filter(e => e.system?.playbook === this._playbookDoc.name);
		const docs = await Promise.all(relevant.map(e => pack.getDocument(e._id)));
		return docs.filter(Boolean);
	}

	// Resume stores each "either X OR Y" pick as the owned move's NAME, because its
	// compendium id isn't knowable from the actor alone. Once the move list is loaded
	// (it maps name → id), swap any name-valued pick for its id so the radio matches
	// on the Moves step and the apply step re-grants by id. Idempotent: real ids never
	// collide with move names, so already-resolved picks are left untouched.
	_reconcileMoveChoices() {
		if (!this._movesCache) return;
		const idByName = new Map(this._movesCache.map(doc => [doc.name, doc.id]));
		for (const [groupIndex, value] of Object.entries(this._selections.moveChoices)) {
			if (idByName.has(value)) this._selections.moveChoices[groupIndex] = idByName.get(value);
		}
	}

	// ── Stat helpers ──────────────────────────────────────────────────

	_parseStatScores() {
		const note = this._playbookDoc.flags?.stonetop?.statsNote ?? "";
		const matches = note.match(/[+-]?\d+/g);
		return matches ? matches.map(Number) : [2, 1, 1, 0, 0, -1];
	}

	_validateStats() {
		const required = this._statScores.slice().sort((a, b) => a - b);
		const assigned = Object.values(this._selections.stats);
		if (assigned.some(v => v === null)) return false;
		const actual = assigned.map(Number).sort((a, b) => a - b);
		return required.length === actual.length && required.every((v, i) => v === actual[i]);
	}

	// ── Possession sub-choices ────────────────────────────────────────

	// Render-data for a possession's bundled "pick N" list (Weapons of war, etc.),
	// or null when the possession has no such bundle. The list is always shown, but
	// its options stay disabled until the parent possession is picked — owning the
	// bundle is what spends one of the limited possession slots. Each sub-option
	// carries its parent slug so the change handler and glyph pass don't depend on
	// DOM nesting.
	_possessionChoiceData(opt, parentSelected) {
		if (!opt?.choices?.options?.length) return null;
		const pickCount = opt.choices.pickCount ?? 0;
		const picked    = this._selections.possessionChoices[opt.slug] ?? [];
		const atLimit   = picked.length >= pickCount;
		return {
			possessionSlug: opt.slug,
			pickCount,
			pickNote:       this._normalizeOnboardingText(opt.choices.pickNote ?? `Pick ${pickCount}`),
			selectedCount:  picked.length,
			locked:         !parentSelected,
			options: opt.choices.options.map(c => {
				const isSelected = picked.includes(c.slug);
				return {
					possessionSlug: opt.slug,
					slug:           c.slug,
					label:          this._normalizeOnboardingText(c.label),
					isSelected,
					disabled:       !parentSelected || (!isSelected && atLimit),
				};
			}),
		};
	}

	// Render-data for a possession's "choose 1 on each line" flavor groups (the
	// Blessed's sacred pouch: heirloom/material/decoration), or null when it has none.
	// Picks share the same possessionChoices[slug] array as the pick-N bundles but are
	// purely cosmetic, so they never gate step completion (see _possessionSubChoicesComplete).
	// Each subgroup is a radio (pick 1) unless flagged multiSelect; locked until the
	// parent possession is owned — the sacred pouch is preselected, so always open.
	_possessionChoiceGroupsData(opt, parentSelected) {
		if (!opt?.choiceGroups?.length) return null;
		const picked = new Set(this._selections.possessionChoices[opt.slug] ?? []);
		return opt.choiceGroups.map((cg, cgIdx) => ({
			heading: this._normalizeOnboardingText(cg.heading ?? ""),
			note:    cg.note ? this._normalizeOnboardingText(cg.note) : "",
			subgroups: cg.subgroups.map((sg, sgIdx) => {
				const groupId  = `${opt.slug}-cg${cgIdx}-sg${sgIdx}`;
				const slugsCsv = sg.options.map(o => o.slug).join(",");
				return {
					groupId,
					possessionSlug: opt.slug,
					multiSelect:    !!sg.multiSelect,
					options: sg.options.map(o => ({
						possessionSlug: opt.slug,
						groupId,
						slug:           o.slug,
						label:          this._normalizeOnboardingText(o.label),
						siblingSlugsCsv: slugsCsv,
						isSelected:     picked.has(o.slug),
						disabled:       !parentSelected,
					})),
				};
			}),
		}));
	}

	// Total possession picks spent: listed options plus the write-in, when filled.
	// A filled write-in counts as one pick, so it shares the playbook's pick budget.
	_possessionPickTotal() {
		return this._selections.possessions.length + (this._selections.customPossession?.trim() ? 1 : 0);
	}

	// A selected possession with a required "pick N" bundle isn't done until N
	// sub-options are picked (e.g. the Judge must choose 1 symbol of authority). Bundles
	// flagged `optional` are "choose up to N, now or later" (Weapons of war) and never
	// gate completion — the player can take 0 weapons now and the rest as they acquire them.
	_possessionSubChoicesComplete() {
		const preselected = new Set(this._rawPossessions?.preselected ?? []);
		const active = new Set([...this._selections.possessions, ...preselected]);
		return (this._rawPossessions?.options ?? []).every(opt => {
			if (!active.has(opt.slug) || !opt.choices?.options?.length || opt.choices.optional) return true;
			return (this._selections.possessionChoices[opt.slug] ?? []).length >= (opt.choices.pickCount ?? 0);
		});
	}

	// Sync a bundle's count readout and its options' disabled state from current
	// selections (the parent change handler re-renders nothing, so we touch the DOM):
	// every option is locked until the parent possession is picked, then remaining
	// options lock once the pick limit is hit.
	_refreshPossessionSubUi(html, possessionSlug) {
		const opt = (this._rawPossessions?.options ?? []).find(o => o.slug === possessionSlug);
		const pickCount = opt?.choices?.pickCount ?? 0;
		const parentSelected = this._selections.possessions.includes(possessionSlug) ||
			(this._rawPossessions?.preselected ?? []).includes(possessionSlug);
		const picked = this._selections.possessionChoices[possessionSlug] ?? [];
		html.find(`.stonetop-onboarding-suboption-count[data-possession="${possessionSlug}"]`).text(picked.length);
		html.find(`.stonetop-onboarding-suboptions[data-possession="${possessionSlug}"]`)
			.toggleClass("is-locked", !parentSelected);
		const atLimit = picked.length >= pickCount;
		html.find(`[name='onboard-possession-sub'][data-possession="${possessionSlug}"]`).each((_, el) => {
			el.disabled = !parentSelected || (!el.checked && atLimit);
		});
	}

	// Clear a bundle's picks after its parent possession is deselected: uncheck every
	// sub-checkbox and drop its selected styling. The caller refreshes disabled/count.
	_clearPossessionSubUi(html, possessionSlug) {
		html.find(`[name='onboard-possession-sub'][data-possession="${possessionSlug}"]`).each((_, el) => {
			el.checked = false;
			el.closest(".stonetop-onboarding-suboption")?.classList.remove("is-selected");
		});
	}

	// Sync the shared pick budget across the possession step (listed options + write-in)
	// after any selection changes: update the counter, lock unpicked options once the
	// budget is spent, and lock the write-in unless it already holds a pick (so an
	// in-progress write-in can still be edited or cleared).
	_refreshPossessionLimitUi(html) {
		const pickCount = this._rawPossessions?.pickCount ?? 0;
		const total = this._possessionPickTotal();
		const atLimit = total >= pickCount;
		html.find(".stonetop-onboarding-possession-count").text(total);
		html.find("[name='onboard-possession']:not([data-preselected])").each((_, el) => {
			if (!el.checked) el.disabled = atLimit;
		});
		const customFilled = !!this._selections.customPossession?.trim();
		html.find(".onboard-possession-custom").each((_, el) => {
			el.disabled = atLimit && !customFilled;
		});
	}

	// ── Completion check ──────────────────────────────────────────────

	_isStepComplete(stepType = this._steps[this._step]) {
		const ac = this._selections.animalCompanion;
		switch (stepType) {
			case "background": {
				const bg = this._selectedBackground();
				if (!bg) return false;
				const moveChoicesComplete = this._backgroundMoveChoices(bg).every(choice => {
					if (!choice.options?.length) return true;
					const key = this._moveChoiceKey(choice);
					return !!this._selections.backgroundChoices[key]?.value;
				});
				const setup = this._backgroundSetup(bg);
				const setupChoicesComplete = (setup?.choices ?? []).every(choice =>
					!!this._selections.backgroundSetup.choices[choice.key]
				);
				const setupTextsComplete = (setup?.texts ?? []).every(text =>
					!!this._selections.backgroundSetup.texts[text.key]?.trim()
				);
				const neighborTraitsComplete = (setup?.neighbors ?? []).every(neighbor =>
					!neighbor.traitKey || !!this._selections.backgroundSetup.neighborTraits[neighbor.traitKey]?.trim()
				);
				const neighborChoicesComplete = (setup?.neighborChoices ?? []).every(choice => {
					const count = Number(choice.count ?? 1);
					return (this._selections.backgroundSetup.neighborPicks[choice.key] ?? []).length === count;
				});
				const markableActionsComplete = this._backgroundActionsComplete(bg);
				return moveChoicesComplete && setupChoicesComplete && setupTextsComplete &&
					neighborTraitsComplete && neighborChoicesComplete && markableActionsComplete;
			}
			case "instinct":       return !!this._selections.instinctValue.trim();
			case "appearance":     return this._rawAppearance.every((_, i) => !!this._selections.appearance[i]);
			case "origin":         return !!this._selections.originRegion && !!this._selections.name?.trim();
			case "stats":          return this._validateStats();
			case "possession":     return this._possessionPickTotal() === (this._rawPossessions?.pickCount ?? 0) &&
			                              this._possessionSubChoicesComplete();
			case "moves": {
				const choicesComplete = this._rawMoveChoices.every((_, i) => !!this._selections.moveChoices[i]);
				return choicesComplete && this._selections.moves.length === this._movePickCount;
			}
			case "invocations":    return this._selections.invocations.length === (this._rawInvocations?.startingCount ?? 0);
			case "initiates": {
				const d = this._getInitiatesData();
				const [min] = this._initiatesCountRange(d);
				if (this._selections.initiates.length < min) return false;
				const selected = (d?.options ?? []).filter(o => this._selections.initiates.includes(o.slug));
				return selected.every(opt => {
					if (!(opt.choiceRows?.length)) return true;
					const det = this._selections.initiateDetails[opt.slug] ?? {};
					return opt.choiceRows.every((row, rowIdx) => {
						const val = row.type === "pronoun" ? det.pronoun : det.rows?.[rowIdx];
						return !!val?.trim();
					});
				});
			}
			case "crew": {
				const tagLimit = this._rawCrew?.additionalTagCount ?? 2;
				return this._selections.crew.tags.length >= tagLimit &&
				       !!this._selections.crew.instinct &&
				       !!this._selections.crew.cost;
			}
			case "animalCompanion": {
				if (!ac.type) return false;
				const typeData = this._rawAnimalCompanion?.types?.find(t => t.slug === ac.type);
				return !!typeData &&
				       !!ac.kind?.trim() &&
				       ac.traits.length >= typeData.pickCount &&
				       !!ac.instinct && !!ac.cost;
			}
			case "seekerArcana":
				return !!this._selections.arcana.major;
			case "seekerArcanaMinor":
				return Object.values(this._selections.arcana.minorRoles).filter(Boolean).length === 3;
			default: {
				// Lore steps gate Next on the same answered-check the resume flow uses,
				// so a required section (e.g. the Ranger's "choose 1" wicked-threat page)
				// can't be skipped past with no selection. Optional/prose-only sections
				// (no options) report answered, so they stay freely advanceable.
				const loreMatch = stepType?.match(/^lore:(\d+)$/);
				if (loreMatch) {
					return this._isLoreSectionAnswered(this._rawLore[parseInt(loreMatch[1], 10)]);
				}
				return true;
			}
		}
	}

	// ── Resume helpers ───────────────────────────────────────────────

	_parseLorePickMin(section) {
		const desc = String(section?.description ?? "").toLowerCase();
		const rangeM = desc.match(/(?:choose|pick)\s+(\d+)\s*[\u2013\-]\s*(\d+)/);
		if (rangeM) return parseInt(rangeM[1], 10);
		const orM = desc.match(/(?:choose|pick)\s+(\d+)\s+or\s+(\d+)/);
		if (orM) return parseInt(orM[1], 10);
		const maybeM = desc.match(/(?:choose|pick)\s+(\d+)[,\s]+maybe\s+(\d+)/);
		if (maybeM) return parseInt(maybeM[1], 10);
		const singleM = desc.match(/(?:choose|pick)\s+(\d+)/);
		if (singleM) return parseInt(singleM[1], 10);
		const opts = section?.options ?? [];
		if (opts.length > 0 && opts.every(o => !o.type && (o.max ?? 1) === 1)) return 1;
		return 0;
	}

	// How many of a free-text section's prompts must be answered. These are "Answer at
	// least N of the following" sets, so only N need text, not every one. The count
	// lives in the section title ("Answer At Least 3 of the Following") or its
	// description ("Answer at least 2 questions about it"). When the section states
	// no such number it's a single multi-part prompt (e.g. the Would-Be Hero's
	// "when / what did you do / how did it turn out"), so EVERY prompt is required —
	// the default is the prompt count, never 1, or a multi-part question could be
	// skipped past with one blank filled. Result is clamped to the prompt count.
	_parseTextAnswerMin(section, textOptionCount) {
		const haystack = `${section?.title ?? ""} ${section?.description ?? ""}`.toLowerCase();
		const m = haystack.match(/answer\s+at\s+least\s+(\d+)/);
		const min = m ? parseInt(m[1], 10) : textOptionCount;
		return Math.max(0, Math.min(min, textOptionCount));
	}

	_countLoreSectionTextAnswers(section, textOptions = (section?.options ?? []).filter(o => o.type === "text")) {
		return textOptions.filter(opt =>
			!!this._selections.lore.texts[`${section.slug}:${opt.slug}`]?.trim()
		).length;
	}

	_isLoreSectionAnswered(section) {
		const opts = section?.options ?? [];
		if (!opts.length) return true;
		const textOptions = opts.filter(o => o.type === "text");
		if (textOptions.length) {
			const min = this._parseTextAnswerMin(section, textOptions.length);
			return this._countLoreSectionTextAnswers(section, textOptions) >= min;
		}
		const min = this._parseLorePickMin(section);
		return min <= 0 || this._countLoreSectionPicks(section.slug) >= min;
	}

	_isStepAnsweredForResume(stepType) {
		const loreMatch = stepType?.match(/^lore:(\d+)$/);
		if (loreMatch) {
			const section = this._rawLore[parseInt(loreMatch[1], 10)];
			return this._isLoreSectionAnswered(section);
		}
		if (stepType === "origin") {
			return !!this._selections.originRegion && !!this._selections.name?.trim();
		}
		if (stepType === "seekerArcana") {
			const section = this._rawLore.find(s => s.slug === "arcana-major");
			return this._isStepComplete(stepType) && this._isLoreSectionAnswered(section);
		}
		if (stepType === "seekerArcanaMinor") {
			const section = this._rawLore.find(s => s.slug === "arcana-minor");
			return this._isStepComplete(stepType) && this._isLoreSectionAnswered(section);
		}
		return this._isStepComplete(stepType);
	}

	_isResumeQuestionStep(stepType) {
		return stepType?.startsWith("lore:") || [
			"background",
			"instinct",
			"appearance",
			"origin",
			"initiates",
			"crew",
			"animalCompanion",
			"seekerArcana",
			"seekerArcanaMinor",
		].includes(stepType);
	}

	_firstIncompleteStepIndex() {
		for (let i = 0; i < this._steps.length; i++) {
			if (!this._isResumeQuestionStep(this._steps[i])) continue;
			if (!this._isStepAnsweredForResume(this._steps[i])) return i;
		}
		return 0;
	}

	// ── Foundry Application boilerplate ──────────────────────────────

	getQuestionCompletionDiagnostics() {
		const steps = this._steps
			.map((stepType, index) => this._stepDiagnostic(stepType, index))
			.filter(step => step.isQuestionStep);
		const incomplete = steps.filter(step => !step.complete);
		return {
			playbook: this._playbookDoc?.name ?? "",
			firstIncomplete: incomplete[0] ?? null,
			incomplete,
			steps,
		};
	}

	_stepDiagnostic(stepType, index) {
		return {
			index,
			stepType,
			label: this._stepDiagnosticLabel(stepType),
			isQuestionStep: this._isResumeQuestionStep(stepType),
			complete: this._isStepAnsweredForResume(stepType),
			details: this._stepDiagnosticDetails(stepType),
		};
	}

	_resolveLoreSection(stepType) {
		const m = stepType?.match(/^lore:(\d+)$/);
		if (!m) return undefined;
		return this._rawLore[parseInt(m[1], 10)] ?? null;
	}

	_stepDiagnosticLabel(stepType) {
		const section = this._resolveLoreSection(stepType);
		if (section !== undefined) {
			return this._normalizeOnboardingText(section?.title ?? stepType);
		}
		return ({
			background: "Background",
			instinct: "Instinct",
			appearance: "Appearance",
			origin: "Origin",
			initiates: "Initiates",
			crew: "Crew",
			animalCompanion: "Animal Companion",
			seekerArcana: "Major Arcana",
			seekerArcanaMinor: "Minor Arcana",
		})[stepType] ?? stepType;
	}

	_stepDiagnosticDetails(stepType) {
		const section = this._resolveLoreSection(stepType);
		if (section !== undefined) {
			if (!section) return { reason: "Lore section not found" };
			const textOptions = (section.options ?? []).filter(opt => opt.type === "text");
			const min = this._parseLorePickMin(section);
			const selected = this._countLoreSectionPicks(section.slug);
			return {
				sectionSlug: section.slug,
				requiredPicks: textOptions.length ? null : min,
				selectedPicks: textOptions.length ? null : selected,
				// For "answer at least N" text sets, completeness is the count answered
				// vs. N — not whether every prompt has text.
				requiredAnswers: textOptions.length ? this._parseTextAnswerMin(section, textOptions.length) : null,
				answeredCount: textOptions.length ? this._countLoreSectionTextAnswers(section, textOptions) : null,
				textAnswers: textOptions.map(opt => ({
					optionSlug: opt.slug,
					hasAnswer: !!this._selections.lore.texts[`${section.slug}:${opt.slug}`]?.trim(),
				})),
			};
		}
		switch (stepType) {
			case "background": return this._backgroundStepDiagnostic();
			case "instinct":
				return { selected: this._selections.instinctValue || "" };
			case "appearance":
				return {
					requiredLines: this._rawAppearance.length,
					selectedLines: Object.keys(this._selections.appearance).filter(key => !!this._selections.appearance[key]).length,
					missingLines: this._rawAppearance
						.map((_, i) => i)
						.filter(i => !this._selections.appearance[i]),
				};
			case "origin":
				return {
					originRegion: this._selections.originRegion || "",
					name: this._selections.name || "",
					missing: [
						...(!this._selections.originRegion ? ["originRegion"] : []),
						...(!this._selections.name?.trim() ? ["name"] : []),
					],
				};
			case "initiates": {
				const data = this._getInitiatesData();
				const [min] = this._initiatesCountRange(data);
				return {
					requiredMin: min,
					selectedCount: this._selections.initiates.length,
					selected: [...this._selections.initiates],
				};
			}
			case "crew": {
				const tagLimit = this._rawCrew?.additionalTagCount ?? 2;
				return {
					requiredTags: tagLimit,
					selectedTags: this._selections.crew.tags.length,
					hasInstinct: !!this._selections.crew.instinct,
					hasCost: !!this._selections.crew.cost,
				};
			}
			case "animalCompanion": {
				const ac = this._selections.animalCompanion;
				const typeData = this._rawAnimalCompanion?.types?.find(t => t.slug === ac.type);
				return {
					type: ac.type || "",
					kind: ac.kind || "",
					requiredTraits: typeData?.pickCount ?? null,
					selectedTraits: ac.traits.length,
					hasInstinct: !!ac.instinct,
					hasCost: !!ac.cost,
				};
			}
			case "seekerArcana":
				return { major: this._selections.arcana.major || "" };
			case "seekerArcanaMinor":
				return {
					roles: { ...this._selections.arcana.minorRoles },
					assignedCount: Object.values(this._selections.arcana.minorRoles).filter(Boolean).length,
				};
			default:
				return {};
		}
	}

	_backgroundStepDiagnostic() {
		const backgroundSlug = this._selections.backgroundSlug || "";
		const bg = this._backgrounds.find(b => b.slug === backgroundSlug);
		if (!backgroundSlug || !bg) return { backgroundSlug, missing: ["background"] };
		const missing = [];
		for (const choice of this._backgroundMoveChoices(bg)) {
			if (!choice.options?.length) continue;
			const key = this._moveChoiceKey(choice);
			if (!this._selections.backgroundChoices[key]?.value) missing.push(`moveChoice:${key}`);
		}
		const setup = this._backgroundSetup(bg);
		for (const choice of (setup?.choices ?? [])) {
			if (!this._selections.backgroundSetup.choices[choice.key]) missing.push(`setupChoice:${choice.key}`);
		}
		for (const text of (setup?.texts ?? [])) {
			if (!this._selections.backgroundSetup.texts[text.key]?.trim()) missing.push(`setupText:${text.key}`);
		}
		for (const neighbor of (setup?.neighbors ?? [])) {
			if (neighbor.traitKey && !this._selections.backgroundSetup.neighborTraits[neighbor.traitKey]?.trim()) {
				missing.push(`neighborTrait:${neighbor.traitKey}`);
			}
		}
		for (const choice of (setup?.neighborChoices ?? [])) {
			const count = Number(choice.count ?? 1);
			const selected = this._selections.backgroundSetup.neighborPicks[choice.key] ?? [];
			if (selected.length !== count) missing.push(`neighborChoice:${choice.key} (${selected.length}/${count})`);
		}
		const markable = bg.markableActions;
		if (markable?.options?.length) {
			const allowed = allowedMarkableActions(markable, 1);
			const marked  = this._selections.markedActions.length;
			if (marked < allowed) missing.push(`markedActions (${marked}/${allowed})`);
		}
		return { backgroundSlug, missing };
	}

	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id:        "stonetop-character-onboarding",
			template:  "systems/stonetop/templates/dialogs/character-onboarding.hbs",
			width:     660,
			height:    740,
			resizable: true,
			classes:   ["stonetop", "stonetop-onboarding"],
		});
	}

	get title() {
		return `New Character — ${this._playbookDoc.name}`;
	}

	async _render(force, options) {
		// The animal-companion step is gated on owning the Animal Companion move, so
		// a companion playbook (the Ranger) needs its move list loaded before the
		// step list is finalized — otherwise a resumed character who picked the move
		// outside Beast-Bonded wouldn't see the step until they revisited Moves.
		if (this._rawAnimalCompanion?.types?.length && !this._movesCache) {
			this._movesCache = await this._loadPlaybookMoves();
			this._reconcileMoveChoices();
			this._rebuildDynamicSteps();
		}
		await super._render(force, options);
		this._frontOnOpen.apply();
		this._reportProgress();
	}

	// Tell the creation flow which page the player is on, but only when it actually
	// changes — every option click re-renders, and we don't want to write the same
	// progress flag (a server round-trip + broadcast to the GM) on every tick.
	_reportProgress() {
		if (!this._onProgress) return;
		const step  = this._step;
		const total = this._steps.length;
		if (this._reportedStep === step && this._reportedTotal === total) return;
		this._reportedStep  = step;
		this._reportedTotal = total;
		this._onProgress(this._progressInfo());
	}

	// Where the player currently is: the page (for the GM's "page X of Y") plus the
	// chosen step + selections, so a reload can reopen this exact page (the creation
	// flow stamps this on the actor — see _launchOnboarding in StonetopCharacterSheet).
	_progressInfo() {
		return {
			step:       this._step,
			total:      this._steps.length,
			stepType:   this._steps[this._step] ?? null,
			selections: this._selections,
		};
	}

	// Debounced live-save of the current page (see the delegated input/change
	// listener in activateListeners). Routes through onLiveSave, which writes only to
	// cheap client-local storage — never the database/network — so typing fast can't
	// generate traffic. Skips when there's nowhere to save, or once the dialog has
	// finished, so a save in flight when the player clicks Finish can't resurrect the
	// snapshot the completion just cleared.
	_scheduleSnapshotSave() {
		if (!this._onLiveSave) return;
		clearTimeout(this._snapshotSaveTimer);
		this._snapshotSaveTimer = setTimeout(() => {
			this._snapshotSaveTimer = null;
			if (this._completed) return;
			this._onLiveSave(this._progressInfo());
		}, 600);
	}

	_getHeaderButtons() {
		const buttons = super._getHeaderButtons();
		if (this._onSave) {
			buttons.unshift({
				label:   game.i18n.localize("stonetop.onboarding.saveButton"),
				class:   "stonetop-onboarding-save-header",
				icon:    "fas fa-save",
				onclick: () => this._saveProgress(),
			});
		}
		return buttons;
	}

	// ── getData ───────────────────────────────────────────────────────

	async getData() {
		const stepType = this._steps[this._step] ?? null;
		const isFirst  = this._step === 0;
		const isLast   = this._step === this._steps.length - 1 || this._steps.length === 0;
		const hasBack  = !!this._onBack;

		const progressDots = this._steps.map((_, i) => ({
			active: i === this._step,
			done:   i < this._step,
		}));

		let backgrounds     = null;
		let instincts       = null;
		let appearanceLines = null;
		let origins         = null;
		let statBoxes         = null;
		let statScores        = null;
		let statScoresDisplay = "";
		let possession        = null;
		let moveOptions       = null;
		let moveChoiceGroups  = null;
		let movePickNote      = "";
		let invocationData    = null;
		let initiatesData     = null;
		let crewData          = null;
		let acData            = null;
		let loreSectionData   = null;
		let seekerArcanaData  = null;
		let seekerArcanaChoices = null;

		// ── Background ────────────────────────────────────────────────
		if (stepType === "background") {
			const arcana = this._combineSeekerArcana ? await this._loadArcanaOptions() : null;
			const majorBySlug = new Map((arcana?.major ?? []).map(option => [option.slug, option]));
			backgrounds = this._backgrounds.map(bg => ({
				slug:        bg.slug,
				label:       this._normalizeOnboardingText(bg.label),
				description: this._normalizeOnboardingText(bg.description),
				selected:    this._selections.backgroundSlug === bg.slug,
				moveChoices: this._backgroundMoveChoiceData(bg),
				setup: this._backgroundSetupData(bg),
				markableActions: this._backgroundMarkableActionsData(bg),
				majorArcana: (bg.majorArcana ?? []).map(slug => {
					const option = majorBySlug.get(slug);
					return option ? {
						...option,
						backgroundSlug: bg.slug,
						selected: this._selections.arcana.major === slug,
					} : null;
				}).filter(Boolean),
			}));
		}

		// ── Instinct ──────────────────────────────────────────────────
		if (stepType === "instinct") {
			instincts = this._rawInstincts.map(inst => {
				// Compose via the shared helper so a suggestion's value matches the
				// one the sheet/snapshot store, keeping the custom-vs-suggestion check honest.
				const value = composeInstinct(inst.word, inst.description);
				return { word: inst.word, description: inst.description, value,
				         selected: this._selections.instinctValue === value };
			});
		}

		// ── Appearance ────────────────────────────────────────────────
		if (stepType === "appearance") {
			appearanceLines = this._rawAppearance.map((opts, lineIdx) => {
				const selected = this._selections.appearance[lineIdx] ?? "";
				const customSelected = !!selected && !opts.includes(selected);
				return {
					lineIdx,
					label: this._appearanceLineLabel(opts, lineIdx),
					customValue: customSelected ? selected : "",
					customSelected,
					options: opts.map(value => ({
						value,
						selected: selected === value,
					})),
				};
			});
		}

		// ── Origin ────────────────────────────────────────────────────
		if (stepType === "origin") {
			origins = this._origins.map(o => ({
				region:   o.region,
				names:    o.names ?? [],
				nameGroups: this._isGordinsDelve(o.region) ? this._originNameGroups() : [],
				isGordinsDelve: this._isGordinsDelve(o.region),
				selected: this._selections.originRegion === o.region,
			}));
		}

		// ── Stats ─────────────────────────────────────────────────────
		if (stepType === "stats") {
			const scores    = this._statScores;
			const poolCount = this._statPoolCount;

			statScores = [...scores].sort((a, b) => b - a)
				.map(v => v >= 0 ? `+${v}` : String(v));
			statScoresDisplay = statScores.join(", ");

			const STAT_DEFS = [
				{ key: "str", abbr: "STR", label: "Strength" },
				{ key: "dex", abbr: "DEX", label: "Dexterity" },
				{ key: "con", abbr: "CON", label: "Constitution" },
				{ key: "int", abbr: "INT", label: "Intelligence" },
				{ key: "wis", abbr: "WIS", label: "Wisdom" },
				{ key: "cha", abbr: "CHA", label: "Charisma" },
			];
			statBoxes = STAT_DEFS.map(s => {
				const assigned = this._selections.stats[s.key];
				const otherCount = {};
				for (const other of STAT_DEFS) {
					if (other.key === s.key) continue;
					const v = this._selections.stats[other.key];
					if (v !== null) otherCount[v] = (otherCount[v] ?? 0) + 1;
				}
				const validValues = Object.keys(poolCount)
					.map(Number)
					.filter(v => (poolCount[v] - (otherCount[v] ?? 0)) >= 1)
					.sort((a, b) => b - a);
				return {
					...s,
					assigned: assigned !== null,
					options: validValues.map(v => ({
						value:    v,
						label:    v >= 0 ? `+${v}` : String(v),
						selected: assigned === v,
					})),
				};
			});
		}

		// ── Moves ─────────────────────────────────────────────────────
		if (stepType === "moves") {
			if (!this._movesCache) {
				this._movesCache = await this._loadPlaybookMoves();
				this._reconcileMoveChoices();
			}
			const selectedBg  = this._backgrounds.find(b => b.slug === this._selections.backgroundSlug);
			const bgMoveNames = new Set(selectedBg?.moves ?? []);
			const chosenIds   = new Set(this._selections.moves);
			const atLimit     = chosenIds.size >= this._movePickCount;
			const n           = this._movePickCount;
			movePickNote = `Choose ${n} more starting ${n === 1 ? "move" : "moves"}`;

			const docByName = new Map(this._movesCache.map(doc => [doc.name, doc]));
			// "Either X OR Y" choice groups (e.g. the Heavy's Armored OR Uncanny
			// Reflexes). The chosen move is granted separately, so its options are
			// kept out of the free-pick list below.
			const choiceMoveNames = new Set(this._rawMoveChoices.flatMap(g => g.options ?? []));
			moveChoiceGroups = this._rawMoveChoices.map((group, groupIndex) => ({
				groupIndex,
				label: this._normalizeOnboardingText(group.label ?? "Choose one"),
				options: (group.options ?? []).flatMap(name => {
					const doc = docByName.get(name);
					if (!doc) return [];
					return [{
						groupIndex,
						id:          doc.id,
						name:        this._normalizeOnboardingText(doc.name),
						description: this._normalizeOnboardingText(doc.system?.description),
						selected:    this._selections.moveChoices[groupIndex] === doc.id,
					}];
				}),
			}));

			const grantedNames = new Set([
				...this._movesCache.filter(d => d.system?.isStartingMove).map(d => d.name),
				...bgMoveNames,
			]);
			moveOptions = this._movesCache
				.filter(doc => {
					if (doc.system?.isStartingMove) return false;
					if (bgMoveNames.has(doc.name)) return false;
					if (choiceMoveNames.has(doc.name)) return false;
					if (doc.system?.requirement?.level > 1) return false;
					const reqMoves = doc.system?.requirement?.moves ?? [];
					if (reqMoves.length && !reqMoves.every(r => grantedNames.has(r))) return false;
					return true;
				})
				.map(doc => ({
					id:          doc.id,
					name:        this._normalizeOnboardingText(doc.name),
					description: this._normalizeOnboardingText(doc.system?.description),
					selected:    chosenIds.has(doc.id),
					disabled:    !chosenIds.has(doc.id) && atLimit,
					groups:      moveGroupKeys(this._playbookDoc.name, doc.name),
				}));
		}

		// ── Possession ────────────────────────────────────────────────
		if (stepType === "possession") {
			const raw         = this._rawPossessions;
			const pickCount   = raw.pickCount ?? 0;
			const preselected = new Set(raw.preselected ?? []);
			const chosen      = new Set(this._selections.possessions);
			const customLabel = this._selections.customPossession ?? "";
			const total       = this._possessionPickTotal();
			const atLimit     = total >= pickCount;
			possession = {
				pickNote:      raw.pickNote ?? `Pick ${pickCount}`,
				pickCount,
				selectedCount: total,
				// Write-in possession card: editable unless the picks are spent elsewhere.
				custom: {
					label:    customLabel,
					filled:   !!customLabel.trim(),
					disabled: atLimit && !customLabel.trim(),
				},
				options: (raw.options ?? []).map(opt => {
					const isPre = preselected.has(opt.slug);
					const isChosen = chosen.has(opt.slug);
					const isSelected = isPre || isChosen;
					return {
						slug: opt.slug,
						label: this._normalizeOnboardingText(opt.label),
						description: this._normalizeOnboardingText(opt.description),
						isPreselected: isPre, isSelected,
						disabled: isPre || (!isSelected && atLimit),
						// "Pick N from this list" bundles (Weapons of war, Symbol of
						// authority…). Always rendered; the options stay disabled until the
						// parent possession is selected (no re-render on toggle).
						choices: this._possessionChoiceData(opt, isSelected),
						// "Choose 1 on each line" flavor groups (the sacred pouch's
						// heirloom/material/decoration). Optional; same disabled rule.
						choiceGroups: this._possessionChoiceGroupsData(opt, isSelected),
					};
				}),
			};
		}

		// ── Invocations ───────────────────────────────────────────────
		if (stepType === "invocations") {
			const raw   = this._rawInvocations;
			const count = raw.startingCount ?? 2;
			const chosen = new Set(this._selections.invocations);
			const atLimit = chosen.size >= count;
			invocationData = {
				startingCount: count,
				selectedCount: chosen.size,
				options: (raw.options ?? []).map(opt => ({
					slug:        opt.slug,
					label:       this._normalizeOnboardingText(opt.label),
					description: this._normalizeOnboardingText(opt.description),
					isSelected:  chosen.has(opt.slug),
					disabled:    !chosen.has(opt.slug) && atLimit,
				})),
			};
		}

		// ── Initiates ─────────────────────────────────────────────────
		if (stepType === "initiates") {
			const bg      = this._getInitiatesData();
			const [minCount, maxCount] = this._initiatesCountRange(bg);
			const chosen  = new Set(this._selections.initiates);
			const atLimit = chosen.size >= maxCount;
			initiatesData = {
				label:         bg?.label ?? "",
				minCount, maxCount,
				selectedCount: chosen.size,
				options: (bg?.options ?? []).map(opt => {
					const isSelected = chosen.has(opt.slug);
					const det = this._selections.initiateDetails[opt.slug] ?? {};
					return {
						slug:        opt.slug,
						label:       this._normalizeOnboardingText(opt.label),
						description: this._normalizeOnboardingText(opt.description),
						isSelected,
						disabled:    !isSelected && atLimit,
						choiceRows: (opt.choiceRows ?? []).map((row, rowIdx) => {
							const isPronoun  = row.type === "pronoun";
							const currentVal = isPronoun ? (det.pronoun ?? "") : (det.rows?.[rowIdx] ?? "");
							const optionValues = row.options.map(o => this._normalizeOnboardingText(o));
							const isCustom   = isPronoun && !!currentVal && !optionValues.includes(currentVal);
							return {
								rowIdx,
								slug:        opt.slug,
								isPronoun,
								label:       row.label ? this._normalizeOnboardingText(row.label) : null,
								allowCustom: isPronoun,
								customValue: isCustom ? currentVal : "",
								options: optionValues.map(value => {
									return {
										value,
										slug:    opt.slug,
										rowIdx,
										selected: !isCustom && currentVal === value,
									};
								}),
							};
						}),
					};
				}),
			};
		}

		// ── Crew ──────────────────────────────────────────────────────
		if (stepType === "crew") {
			const raw    = this._rawCrew;
			const bgTag  = raw.backgroundTags?.[this._selections.backgroundSlug] ?? null;
			const chosen = new Set(this._selections.crew.tags);
			const limit  = raw.additionalTagCount ?? 2;
			const atLimit = chosen.size >= limit;
			crewData = {
				name:               this._selections.crew.name,
				bgTag:              this._normalizeOnboardingText(bgTag),
				additionalTagCount: limit,
				selectedTagCount:   chosen.size,
				tags: (raw.availableTags ?? []).map(tag => {
					const isAuto     = tag === bgTag;
					const isSelected = isAuto || chosen.has(tag);
					return {
						slug: tag, label: this._normalizeOnboardingText(tag), isAuto, isSelected,
						disabled: isAuto || (!isSelected && atLimit),
					};
				}),
				instincts: (raw.instincts ?? []).map(v => {
					const value = this._normalizeOnboardingText(v);
					return { value, selected: this._selections.crew.instinct === value };
				}),
				costs: (raw.costs ?? []).map(v => {
					const value = this._normalizeOnboardingText(v);
					return { value, selected: this._selections.crew.cost === value };
				}),
			};
		}

		// ── Lore ──────────────────────────────────────────────────────
		const loreMatch = stepType?.match(/^lore:(\d+)$/);
		if (loreMatch) {
			const idx     = parseInt(loreMatch[1]);
			const section = this._rawLore[idx];
			if (section) loreSectionData = this._loreSectionData(section, idx);
		}

		if (stepType === "seekerArcana" || stepType === "seekerArcanaMinor") {
			seekerArcanaChoices = await this._seekerArcanaChoiceData();
			const collectionSection = this._rawLore.find(s => s.slug === "collection");
			seekerArcanaData = {
				title:       this._normalizeOnboardingText(collectionSection?.title ?? "Collection"),
				description: collectionSection ? this._normalizeOnboardingText(collectionSection.description ?? "") : "",
				sections: (stepType === "seekerArcana" ? ["arcana-major"] : ["arcana-minor"])
					.map(slug => this._rawLore.find(section => section.slug === slug))
					.filter(Boolean)
					.map(section => this._loreSectionData(section)),
			};
		}

		// ── Animal Companion ─────────────────────────────────────────
		if (stepType === "animalCompanion") {
			const raw         = this._rawAnimalCompanion;
			const selType     = this._selections.animalCompanion.type;
			const typeData    = raw.types?.find(t => t.slug === selType) ?? null;
			const chosenTraits = new Set(this._selections.animalCompanion.traits);
			const kind = this._selections.animalCompanion.kind;
			const kindOptionValues = this._animalCompanionKindOptions(typeData);
			const traitAtLimit = chosenTraits.size >= (typeData?.pickCount ?? 0);
			acData = {
				types: (raw.types ?? []).map(t => ({
					slug: t.slug, label: this._normalizeOnboardingText(t.label), examples: this._normalizeOnboardingText(t.examples),
					hp: t.hp, armor: t.armor, damage: t.damage,
					selected: t.slug === selType,
				})),
				selectedType: typeData ? {
					slug:          typeData.slug,
					label:         this._normalizeOnboardingText(typeData.label),
					hp:            typeData.hp,
					armor:         typeData.armor,
					damage:        typeData.damage,
					kind,
					customKind:    kindOptionValues.includes(kind) ? "" : kind,
					isCustomKind:  !!kind && !kindOptionValues.includes(kind),
					kindOptions:   kindOptionValues
						.map(value => ({ value, selected: kind === value })),
					pickCount:     typeData.pickCount,
					selectedCount: chosenTraits.size,
					traits: (typeData.traits ?? []).map(trait => ({
						slug:       trait,
						label:      this._normalizeOnboardingText(trait),
						hasTooltip: !!this._wordCache.get(trait.toLowerCase()),
						isSelected: chosenTraits.has(trait),
						disabled:   !chosenTraits.has(trait) && traitAtLimit,
					})),
				} : null,
				instincts: (raw.instincts ?? []).map(v => {
					const value = this._normalizeOnboardingText(v);
					return { value, selected: this._selections.animalCompanion.instinct === value };
				}),
				costs: (raw.costs ?? []).map(v => {
					const value = this._normalizeOnboardingText(v);
					return { value, selected: this._selections.animalCompanion.cost === value };
				}),
				companionName: this._selections.animalCompanion.name,
			};
		}

		// FAQ entries relevant to this step — stashed so activateListeners can build
		// the hover popup, and surfaced as `hasFaq` to render the corner badge.
		// Memoized per step: getData runs on every re-render (each option click), but
		// the seeded FAQ journal is immutable for this dialog's lifetime, so parse it
		// at most once per step instead of re-scanning the whole FAQ HTML each tick.
		(this._faqByStep ??= new Map());
		if (!this._faqByStep.has(stepType)) this._faqByStep.set(stepType, faqForStep(stepType));
		this._currentFaq = this._faqByStep.get(stepType);

		// A custom instinct (not one of the suggestions) splits into the word /
		// description fields so it reads like the suggested "Word — Description".
		const instinctIsCustom = !!this._selections.instinctValue &&
			!(instincts ?? []).some(i => i.value === this._selections.instinctValue);
		const customInstinct = instinctIsCustom
			? parseInstinct(this._selections.instinctValue)
			: { word: "", description: "" };

		return {
			playbookName:      this._playbookDoc.name,
			// Use the playbook avatar art (assets/icons/playbooks/<slug>_icon.webp),
			// matching the picker, not the flat playbook item icon.
			playbookImg:       playbookIconPath(this._playbookDoc.system?.slug) ?? this._playbookDoc.img,
			stepType,
			hasFaq:            this._currentFaq.length > 0,
			stepNumber:        this._step + 1,
			stepCount:         this._steps.length,
			isFirst, isLast, hasBack,
			showBack:          !isFirst || hasBack,
			isBackground:      stepType === "background",
			isInstinct:        stepType === "instinct",
			isAppearance:      stepType === "appearance",
			isOrigin:          stepType === "origin",
			isStats:           stepType === "stats",
			isPossession:      stepType === "possession",
			isMoves:           stepType === "moves",
			isInvocations:     stepType === "invocations",
			isInitiates:       stepType === "initiates",
			isCrew:            stepType === "crew",
			isAnimalCompanion:  stepType === "animalCompanion",
			isLore:            !!loreMatch,
			isSeekerArcana:      stepType === "seekerArcana",
			isSeekerArcanaMinor: stepType === "seekerArcanaMinor",
			progressDots,
			backgrounds, instincts, appearanceLines, origins,
			selectedInstinct:  this._selections.instinctValue,
			customInstinctWord:        customInstinct.word,
			customInstinctDescription: customInstinct.description,
			selectedName:      this._selections.name,
			statBoxes, statScores, statScoresDisplay,
			possession,
			moveOptions, moveChoiceGroups, movePickNote,
			moveGroups:         moveGroupsForPlaybook(this._playbookDoc.name),
			movePickCount:      this._movePickCount,
			moveSelectedCount:  this._selections.moves.length,
			invocationData, initiatesData, crewData, acData, loreSectionData, seekerArcanaData, seekerArcanaChoices,
			stepComplete:       this._isStepComplete(),
		};
	}

	// ── Listeners ─────────────────────────────────────────────────────

	activateListeners(html) {
		super.activateListeners(html);
		markQuestionBullets(html[0]);
		// Redraw inline ◇/○/□/▶ glyphs in the read-only prose (background & possession
		// descriptions, lore section text, lore pick options like the Seeker's "mark 1 ○
		// on the front of its insert") as the system's styled SVG glyphs — the same
		// treatment the FAQ popup and the live character sheet get. Scoped to display-only
		// containers; the editable answer <textarea>s (onboard-lore-text / -setup-text)
		// are never matched, so a typed glyph in an answer is left untouched.
		html.find(".stonetop-onboarding-card-desc, .stonetop-onboarding-card-inline-desc, .stonetop-onboarding-lore-desc, .stonetop-onboarding-lore-pick-text, .stonetop-onboarding-lore-text-label, .stonetop-onboarding-suboption-label")
			.each((_, el) => wrapStonetopGlyphsInEl(el));
		this._frontOnOpen.start();

		html.find(".stonetop-onboarding-back-to-picker").on("click", () => this._goBack());
		html.find(".stonetop-onboarding-back").on("click", () => this._navigate(-1));
		html.find(".stonetop-onboarding-skip").on("click", () => this._skip());
		html.find(".stonetop-onboarding-next").on("click", () => this._navigate(1));
		html.find(".stonetop-onboarding-confirm").on("click", () => this._confirm());

		// Persist what's typed/picked on the current page shortly after the player
		// pauses, so written answers survive an unexpected reload (lost connection)
		// before they advance. Debounced to avoid a write per keystroke; delegated so
		// it catches every field's own input/change handler (each updates _selections
		// first as the event bubbles up). A clean window-close persists immediately
		// via onExit, so only the last fraction of a second of typing is ever at risk.
		html.on("input change", () => this._scheduleSnapshotSave());

		const _refreshNextButton = () => {
			html.find(".stonetop-onboarding-next, .stonetop-onboarding-confirm")
				.prop("disabled", !this._isStepComplete());
		};

		// Mirror a background change driven by an inline input (setup/neighbor/action
		// pick) onto the background radio cards, so engaging an inner control also
		// selects its card.
		const _syncBackgroundSelection = (prevBackground, backgroundSlug) => {
			if (prevBackground === backgroundSlug) return;
			html.find("[name='onboard-background']").each((_, radio) => {
				radio.checked = radio.value === backgroundSlug;
				radio.closest(".stonetop-onboarding-card")
					?.classList.toggle("is-selected", radio.value === backgroundSlug);
			});
		};

		// ── Background ────────────────────────────────────────────────
		html.find("[name='onboard-background']").on("change", ev => {
			this._applyBackgroundChange(ev.currentTarget.value);
			_refreshNextButton();
		});

		html.find(".stonetop-onboarding-background-move-choices").on("click", ev => {
			ev.stopPropagation();
		});
		html.find(".stonetop-onboarding-background-choice-option").on("click", ev => {
			if (ev.target.type === "radio") return;
			const radio = ev.currentTarget.querySelector("input[type='radio']");
			if (radio && !radio.checked) {
				radio.checked = true;
				radio.dispatchEvent(new Event("change", { bubbles: true }));
			}
		});
		html.find(".stonetop-onboarding-background-choice-option input[type='radio']").on("change", ev => {
			const { backgroundSlug, choiceKey, choiceLabel } = ev.currentTarget.dataset;
			const prevBackground = this._selections.backgroundSlug;
			this._applyBackgroundChange(backgroundSlug);
			this._selections.backgroundChoices[choiceKey] = {
				label: choiceLabel,
				value: ev.currentTarget.value,
			};
			html.find(`[name='${ev.currentTarget.name}']`).each((_, radio) => {
				radio.closest(".stonetop-onboarding-background-choice-option")
					?.classList.toggle("is-selected", radio.checked);
			});
			_syncBackgroundSelection(prevBackground, backgroundSlug);
			_refreshNextButton();
		});

		html.find(".stonetop-onboarding-background-setup").on("click", ev => {
			ev.stopPropagation();
		});
		html.find(".stonetop-onboarding-background-setup-option").on("click", ev => {
			if (ev.target.type === "radio") return;
			const radio = ev.currentTarget.querySelector("input[type='radio']");
			if (radio && !radio.checked) {
				radio.checked = true;
				radio.dispatchEvent(new Event("change", { bubbles: true }));
			}
		});
		html.find(".stonetop-onboarding-background-setup-option input[type='radio']").on("change", ev => {
			const { backgroundSlug, choiceKey } = ev.currentTarget.dataset;
			const prevBackground = this._selections.backgroundSlug;
			this._applyBackgroundChange(backgroundSlug);
			this._selections.backgroundSetup.choices[choiceKey] = ev.currentTarget.value;
			html.find(`[name='${ev.currentTarget.name}']`).each((_, radio) => {
				radio.closest(".stonetop-onboarding-background-setup-option")
					?.classList.toggle("is-selected", radio.checked);
			});
			_syncBackgroundSelection(prevBackground, backgroundSlug);
			_refreshNextButton();
		});
		html.find(".onboard-background-setup-text").on("input", ev => {
			const { backgroundSlug, textKey } = ev.currentTarget.dataset;
			const prevBackground = this._selections.backgroundSlug;
			this._applyBackgroundChange(backgroundSlug);
			this._selections.backgroundSetup.texts[textKey] = ev.currentTarget.value;
			_syncBackgroundSelection(prevBackground, backgroundSlug);
			_refreshNextButton();
		});
		// Free-type combo: pick a listed trait from the suggestion popup or type a
		// custom one. The suggestions come from our own scrollable popup rather than a
		// native <datalist> — Chromium's datalist popup has no scrollbar when the list
		// is taller than it (longstanding bug crbug.com/375637), so the bottom of our
		// ~90 trait suggestions was unreachable.
		html.find(".onboard-background-neighbor-trait").on("input", ev => {
			const { backgroundSlug, traitKey } = ev.currentTarget.dataset;
			const prevBackground = this._selections.backgroundSlug;
			this._applyBackgroundChange(backgroundSlug);
			this._selections.backgroundSetup.neighborTraits[traitKey] = ev.currentTarget.value.trim();
			_syncBackgroundSelection(prevBackground, backgroundSlug);
			_refreshNextButton();
		});
		this._attachTraitAutocomplete(html);
		html.find(".stonetop-onboarding-background-neighbor-option").on("click", ev => {
			if (ev.target.type === "checkbox") return;
			const checkbox = ev.currentTarget.querySelector("input[type='checkbox']");
			if (checkbox) {
				checkbox.checked = !checkbox.checked;
				checkbox.dispatchEvent(new Event("change", { bubbles: true }));
			}
		});
		html.find(".stonetop-onboarding-background-neighbor-option input[type='checkbox']").on("change", ev => {
			const { backgroundSlug, choiceKey } = ev.currentTarget.dataset;
			const max = Number(ev.currentTarget.dataset.choiceCount ?? 1);
			const prevBackground = this._selections.backgroundSlug;
			this._applyBackgroundChange(backgroundSlug);
			const current = this._selections.backgroundSetup.neighborPicks[choiceKey] ?? [];
			const value = ev.currentTarget.value;
			let next = ev.currentTarget.checked
				? [...current.filter(v => v !== value), value]
				: current.filter(v => v !== value);
			if (next.length > max) {
				const removed = next.shift();
				const removedInput = html[0].querySelector(
					`input[name='${ev.currentTarget.name}'][value='${removed}']`
				);
				if (removedInput) removedInput.checked = false;
			}
			this._selections.backgroundSetup.neighborPicks[choiceKey] = next;
			html.find(`[name='${ev.currentTarget.name}']`).each((_, checkbox) => {
				checkbox.closest(".stonetop-onboarding-background-neighbor-option")
					?.classList.toggle("is-selected", checkbox.checked);
			});
			_syncBackgroundSelection(prevBackground, backgroundSlug);
			_refreshNextButton();
		});

		// Beast-Bonded "mark an action" list. Like the arcana/neighbor options, these
		// are <span>s inside the background <label>, so stop the click bubbling to the
		// label and forward it to the checkbox manually.
		html.find(".stonetop-onboarding-background-actions").on("click", ev => {
			ev.stopPropagation();
		});
		html.find(".stonetop-onboarding-background-action-option").on("click", ev => {
			if (ev.target.type === "checkbox") return;
			const checkbox = ev.currentTarget.querySelector("input[type='checkbox']");
			if (checkbox && !checkbox.disabled) {
				checkbox.checked = !checkbox.checked;
				checkbox.dispatchEvent(new Event("change", { bubbles: true }));
			}
		});
		html.find(".stonetop-onboarding-background-action-option input[type='checkbox']").on("change", ev => {
			const { backgroundSlug } = ev.currentTarget.dataset;
			const prevBackground = this._selections.backgroundSlug;
			// Engaging a background's action picks that background, mirroring the
			// setup/neighbor/arcana inputs on the other cards.
			this._applyBackgroundChange(backgroundSlug);
			const bg  = this._backgrounds.find(b => b.slug === backgroundSlug);
			const max = allowedMarkableActions(bg?.markableActions, 1);
			const value = ev.currentTarget.value;
			let next = ev.currentTarget.checked
				? [...this._selections.markedActions.filter(v => v !== value), value]
				: this._selections.markedActions.filter(v => v !== value);
			// Enforce the level-1 mark limit by dropping the oldest mark.
			while (next.length > max) {
				const removed = next.shift();
				const removedInput = html[0].querySelector(
					`input[name='onboard-background-action'][value='${removed}']`
				);
				if (removedInput) removedInput.checked = false;
			}
			this._selections.markedActions = next;
			const atLimit = next.length >= max;
			html.find("input[name='onboard-background-action']").each((_, cb) => {
				cb.closest(".stonetop-onboarding-background-action-option")
					?.classList.toggle("is-selected", cb.checked);
				if (!cb.checked) cb.disabled = atLimit;
			});
			html.find(".stonetop-onboarding-background-actions-count").text(next.length);
			_syncBackgroundSelection(prevBackground, backgroundSlug);
			_refreshNextButton();
		});

		// Arcana options are <span>s (not <label>s) because the background card is already
		// a <label> — nesting labels is invalid HTML. Stop the click from bubbling to the
		// background label, and forward it to the radio manually.
		html.find(".stonetop-onboarding-background-arcana").on("click", ev => {
			ev.stopPropagation();
		});
		html.find(".stonetop-onboarding-background-arcana .stonetop-onboarding-arcana-option").on("click", ev => {
			if (ev.target.type === "radio") return;
			const radio = ev.currentTarget.querySelector("input[type='radio']");
			if (radio && !radio.checked) {
				radio.checked = true;
				radio.dispatchEvent(new Event("change", { bubbles: true }));
			}
		});

		html.find("[name='onboard-background-major-arcanum']").on("change", ev => {
			const prevBackground = this._selections.backgroundSlug;
			const { backgroundSlug } = ev.currentTarget.dataset;
			this._applyBackgroundChange(backgroundSlug);
			this._selections.arcana.major = ev.currentTarget.value;

			// Update arcana is-selected without re-rendering.
			html.find("[name='onboard-background-major-arcanum']").each((_, radio) => {
				radio.closest(".stonetop-onboarding-arcana-option")
					?.classList.toggle("is-selected", radio.checked);
			});

			// If the background itself changed, sync the background card selection too.
			if (prevBackground !== backgroundSlug) {
				html.find("[name='onboard-background']").each((_, radio) => {
					radio.closest(".stonetop-onboarding-card")
						?.classList.toggle("is-selected", radio.value === backgroundSlug);
				});
			}

			_refreshNextButton();
		});

		// ── Instinct ──────────────────────────────────────────────────
		html.find("[name='onboard-instinct']").on("change", ev => {
			this._selections.instinctValue = ev.currentTarget.value;
			html.find(".onboard-instinct-word, .onboard-instinct-desc").val("");
			_refreshNextButton();
		});
		// Custom instinct: keep the word to a single token and save the composed
		// "Word — Description" so it matches the suggested instincts' shape.
		html.find(".onboard-instinct-word").on("input", ev => {
			ev.currentTarget.value = ev.currentTarget.value.replace(/\s+/g, "");
		});
		html.find(".onboard-instinct-word, .onboard-instinct-desc").on("input", () => {
			const word = html.find(".onboard-instinct-word").val();
			const desc = html.find(".onboard-instinct-desc").val();
			this._selections.instinctValue = composeInstinct(word, desc);
			html.find("[name='onboard-instinct']").prop("checked", false);
			html.find(".stonetop-onboarding-card").removeClass("is-selected");
			_refreshNextButton();
		});

		// ── Appearance ────────────────────────────────────────────────
		html.find("[name^='onboard-appearance-']").on("change", ev => {
			const lineIdx = Number(ev.currentTarget.name.replace("onboard-appearance-", ""));
			this._selections.appearance[lineIdx] = ev.currentTarget.value;
			this._setSelectedOption(ev.currentTarget.closest(".stonetop-onboarding-appearance-row"), ev.currentTarget);
			if (ev.currentTarget.classList.contains("onboard-appearance-custom-radio")) {
				ev.currentTarget.closest(".stonetop-onboarding-appearance-custom")
					?.querySelector(".onboard-appearance-custom")
					?.focus();
			}
			_refreshNextButton();
		});
		html.find(".onboard-appearance-custom").on("input", ev => {
			const lineIdx = Number(ev.currentTarget.dataset.line);
			this._selections.appearance[lineIdx] = ev.currentTarget.value.trim();
			const row = ev.currentTarget.closest(".stonetop-onboarding-appearance-row");
			const radio = row?.querySelector(".onboard-appearance-custom-radio");
			if (radio) {
				radio.value = ev.currentTarget.value.trim();
				radio.checked = true;
			}
			this._setSelectedOption(row, radio);
			_refreshNextButton();
		});
		html.find(".onboard-appearance-custom-radio").on("change", ev => {
			const lineIdx = Number(ev.currentTarget.dataset.line);
			const input = ev.currentTarget.closest(".stonetop-onboarding-appearance-custom")
				?.querySelector(".onboard-appearance-custom");
			this._selections.appearance[lineIdx] = input?.value.trim() ?? "";
			_refreshNextButton();
		});

		// ── Origin ────────────────────────────────────────────────────
		html.find("[name='onboard-origin']").on("change", ev => {
			this._selections.originRegion = ev.currentTarget.value;
			this.render(false);
		});

		// ── Name ──────────────────────────────────────────────────────
		html.find(".onboard-name-input").on("input", ev => {
			this._selections.name = ev.currentTarget.value;
			_refreshNextButton();
		});

		// ── Stats ─────────────────────────────────────────────────────
		const _updateStatDropdowns = () => {
			const scores    = this._statScores;
			const poolCount = this._statPoolCount;
			const statKeys = ["str", "dex", "con", "int", "wis", "cha"];
			for (const key of statKeys) {
				const selectEl = html.find(`[name="onboard-stat-${key}"]`)[0];
				if (!selectEl) continue;
				const currentVal = this._selections.stats[key];
				const otherCount = {};
				for (const k of statKeys) {
					if (k === key) continue;
					const v = this._selections.stats[k];
					if (v !== null) otherCount[v] = (otherCount[v] ?? 0) + 1;
				}
				const validValues = Object.keys(poolCount)
					.map(Number)
					.filter(v => (poolCount[v] - (otherCount[v] ?? 0)) >= 1)
					.sort((a, b) => b - a);
				selectEl.innerHTML = '<option value="">—</option>' +
					validValues.map(v => {
						const lbl     = v >= 0 ? `+${v}` : String(v);
						const selAttr = currentVal === v ? ' selected' : '';
						return `<option value="${v}"${selAttr}>${lbl}</option>`;
					}).join('');
			}
		};
		const _updateStatScoreChips = () => {
			const usedCount = {};
			for (const value of Object.values(this._selections.stats)) {
				if (value === null) continue;
				usedCount[value] = (usedCount[value] ?? 0) + 1;
			}
			const shownCount = {};
			html.find(".stonetop-onboarding-stats-chip").each((_, chip) => {
				const value = Number(String(chip.dataset.score).replace("+", ""));
				shownCount[value] = (shownCount[value] ?? 0) + 1;
				const remaining = (this._statPoolCount[value] ?? 0) - (usedCount[value] ?? 0);
				chip.hidden = shownCount[value] > remaining;
			});
		};
		const _assignStat = (key, value) => {
			if (!key || value === null || value === undefined || Number.isNaN(value)) return false;
			const otherCount = {};
			for (const [otherKey, otherValue] of Object.entries(this._selections.stats)) {
				if (otherKey === key || otherValue === null) continue;
				otherCount[otherValue] = (otherCount[otherValue] ?? 0) + 1;
			}
			if ((this._statPoolCount[value] ?? 0) - (otherCount[value] ?? 0) < 1) return false;
			this._selections.stats[key] = value;
			const selectEl = html.find(`[name="onboard-stat-${key}"]`)[0];
			const box = selectEl?.closest(".stonetop-onboarding-stat-box")
				?? html.find(`.stonetop-onboarding-stat-box[data-stat-key="${key}"]`)[0];
			box?.classList.add("is-filled");
			_updateStatDropdowns();
			_updateStatScoreChips();
			if (selectEl) selectEl.value = String(value);
			_refreshNextButton();
			return true;
		};

		html.find("[name^='onboard-stat-']").on("change", ev => {
			const key = ev.currentTarget.name.replace("onboard-stat-", "");
			const raw = ev.currentTarget.value;
			this._selections.stats[key] = raw === "" ? null : Number(raw);
			ev.currentTarget.closest(".stonetop-onboarding-stat-box")
				?.classList.toggle("is-filled", raw !== "");
			_updateStatDropdowns();
			_updateStatScoreChips();
			_refreshNextButton();
		});

		html.find(".stonetop-onboarding-stats-reset").on("click", () => {
			for (const key of Object.keys(this._selections.stats)) this._selections.stats[key] = null;
			html.find(".stonetop-onboarding-stat-box").removeClass("is-filled is-drag-over");
			_updateStatDropdowns();
			_updateStatScoreChips();
			_refreshNextButton();
		});

		// ── Special Possessions ───────────────────────────────────────
		html.find(".stonetop-onboarding-stats-chip").on("dragstart", ev => {
			const score = ev.currentTarget.dataset.score;
			ev.originalEvent.dataTransfer.setData("text/plain", score);
			ev.originalEvent.dataTransfer.effectAllowed = "copy";
		});

		html.find(".stonetop-onboarding-stat-box")
			.on("dragover", ev => {
				ev.preventDefault();
				ev.currentTarget.classList.add("is-drag-over");
				ev.originalEvent.dataTransfer.dropEffect = "copy";
			})
			.on("dragleave", ev => {
				ev.currentTarget.classList.remove("is-drag-over");
			})
			.on("drop", ev => {
				ev.preventDefault();
				ev.currentTarget.classList.remove("is-drag-over");
				const raw = ev.originalEvent.dataTransfer.getData("text/plain");
				const value = Number(String(raw).replace("+", ""));
				_assignStat(ev.currentTarget.dataset.statKey, value);
			});
		_updateStatScoreChips();

		html.find("[name='onboard-possession']").on("change", ev => {
			const slug    = ev.currentTarget.value;
			const checked = ev.currentTarget.checked;
			const pickCount = this._rawPossessions?.pickCount ?? 0;
			if (checked) {
				// The write-in shares the pick budget, so check the total, not just the list.
				if (this._possessionPickTotal() < pickCount && !this._selections.possessions.includes(slug)) {
					this._selections.possessions.push(slug);
				} else { ev.currentTarget.checked = false; return; }
			} else {
				this._selections.possessions = this._selections.possessions.filter(s => s !== slug);
				// Dropping the possession drops its bundled "pick N" sub-choices too, so a
				// later re-pick starts fresh and a deselected bundle never lingers in state.
				if (this._selections.possessionChoices[slug]) {
					delete this._selections.possessionChoices[slug];
					this._clearPossessionSubUi(html, slug);
				}
			}
			ev.currentTarget.closest(".stonetop-onboarding-possession-group")
				?.classList.toggle("is-selected", ev.currentTarget.checked);
			ev.currentTarget.closest(".stonetop-onboarding-card--possession")
				?.classList.toggle("is-selected", ev.currentTarget.checked);
			// Lock/unlock this possession's always-visible sub-choice list to match.
			this._refreshPossessionSubUi(html, slug);
			this._refreshPossessionLimitUi(html);
			_refreshNextButton();
		});

		// Write-in possession: filling it spends a pick like any listed option, so the
		// shared budget refresh locks the rest at the limit and reopens them when cleared.
		html.find(".onboard-possession-custom").on("input", ev => {
			this._selections.customPossession = ev.currentTarget.value;
			const filled = !!ev.currentTarget.value.trim();
			ev.currentTarget.closest(".stonetop-onboarding-possession-group")
				?.classList.toggle("is-selected", filled);
			ev.currentTarget.closest(".stonetop-onboarding-card--possession")
				?.classList.toggle("is-selected", filled);
			this._refreshPossessionLimitUi(html);
			_refreshNextButton();
		});

		html.find("[name='onboard-possession-sub']").on("change", ev => {
			const possessionSlug = ev.currentTarget.dataset.possession;
			const choiceSlug     = ev.currentTarget.value;
			const checked        = ev.currentTarget.checked;
			const opt = (this._rawPossessions?.options ?? []).find(o => o.slug === possessionSlug);
			const pickCount = opt?.choices?.pickCount ?? 0;
			const current = this._selections.possessionChoices[possessionSlug] ?? [];
			if (checked) {
				if (current.length < pickCount && !current.includes(choiceSlug)) {
					this._selections.possessionChoices[possessionSlug] = [...current, choiceSlug];
				} else { ev.currentTarget.checked = false; return; }
			} else {
				this._selections.possessionChoices[possessionSlug] = current.filter(s => s !== choiceSlug);
			}
			ev.currentTarget.closest(".stonetop-onboarding-suboption")
				?.classList.toggle("is-selected", ev.currentTarget.checked);
			this._refreshPossessionSubUi(html, possessionSlug);
			_refreshNextButton();
		});

		// "Choose 1 on each line" flavor groups (the sacred pouch). Pick-1 lines are
		// radios: select this option and drop its siblings from the shared picks array.
		html.find("[name^='onboard-possession-cg-']:radio").on("change", ev => {
			const { possession, siblings } = ev.currentTarget.dataset;
			const siblingSet = new Set((siblings ?? "").split(",").filter(Boolean));
			const current = (this._selections.possessionChoices[possession] ?? []).filter(s => !siblingSet.has(s));
			this._selections.possessionChoices[possession] = [...current, ev.currentTarget.value];
			html.find(`[name='${ev.currentTarget.name}']`).each((_, radio) => {
				radio.closest(".stonetop-onboarding-suboption")?.classList.toggle("is-selected", radio.checked);
			});
			_refreshNextButton();
		});

		// Multi-select flavor lines are checkboxes: plain toggle into the picks array.
		html.find("[name='onboard-possession-cg-check']").on("change", ev => {
			const possession = ev.currentTarget.dataset.possession;
			const value      = ev.currentTarget.value;
			const current    = this._selections.possessionChoices[possession] ?? [];
			this._selections.possessionChoices[possession] = ev.currentTarget.checked
				? [...current.filter(s => s !== value), value]
				: current.filter(s => s !== value);
			ev.currentTarget.closest(".stonetop-onboarding-suboption")
				?.classList.toggle("is-selected", ev.currentTarget.checked);
			_refreshNextButton();
		});

		// ── Starting Moves ────────────────────────────────────────────
		html.find("[name='onboard-move']").on("change", ev => {
			const id      = ev.currentTarget.value;
			const checked = ev.currentTarget.checked;
			const limit   = this._movePickCount;
			if (checked) {
				if (this._selections.moves.length < limit && !this._selections.moves.includes(id)) {
					this._selections.moves.push(id);
				} else { ev.currentTarget.checked = false; return; }
			} else {
				this._selections.moves = this._selections.moves.filter(m => m !== id);
			}
			ev.currentTarget.closest(".stonetop-onboarding-card--move")
				?.classList.toggle("is-selected", ev.currentTarget.checked);
			html.find(".stonetop-onboarding-move-count").text(this._selections.moves.length);
			const atLimit = this._selections.moves.length >= limit;
			html.find("[name='onboard-move']:not(:checked)").prop("disabled", atLimit);
			// Picking/dropping the Animal Companion move adds or removes its builder
			// step — only a companion playbook (the Ranger) has that step, so elsewhere
			// the step list can't change and we skip the rebuild.
			if (this._rawAnimalCompanion?.types?.length) this._rebuildDynamicSteps();
			_refreshNextButton();
		});

		// "Either X OR Y" starting-move choices (one radio group per choice).
		html.find("[name^='onboard-move-choice-']").on("change", ev => {
			this._selections.moveChoices[ev.currentTarget.dataset.group] = ev.currentTarget.value;
			html.find(`[name='${ev.currentTarget.name}']`).each((_, radio) => {
				radio.closest(".stonetop-onboarding-card--move-choice")
					?.classList.toggle("is-selected", radio.checked);
			});
			_refreshNextButton();
		});

		// Filter the move cards by the search text and the active group chip. Pure
		// DOM show/hide — never re-renders, so selection and disabled state survive.
		// A card shows only when it satisfies both the query and the active chip.
		let activeMoveGroup = null;
		const applyMoveFilter = () => {
			const query = (html.find(".onboard-move-search").val() ?? "").trim().toLowerCase();
			html.find(".stonetop-onboarding-card--move").each((_, el) => {
				const textMatch  = !query || el.textContent.toLowerCase().includes(query);
				const groups     = (el.dataset.moveGroups ?? "").split(/\s+/).filter(Boolean);
				const groupMatch = !activeMoveGroup || groups.includes(activeMoveGroup);
				el.classList.toggle("is-filtered-out", !(textMatch && groupMatch));
			});
		};
		html.find(".onboard-move-search").on("input", applyMoveFilter);
		html.find(".stonetop-onboarding-move-chip").on("click", ev => {
			const key = ev.currentTarget.dataset.moveGroup;
			activeMoveGroup = activeMoveGroup === key ? null : key; // tap again to clear
			html.find(".stonetop-onboarding-move-chip").each((_, b) => {
				// Block body is load-bearing: classList.toggle returns a boolean, and a
				// bare-arrow `false` return aborts jQuery's .each — which would stop the
				// loop at the first deselected chip, leaving later chips never updated.
				b.classList.toggle("is-active", b.dataset.moveGroup === activeMoveGroup);
			});
			applyMoveFilter();
		});

		// ── Invocations ───────────────────────────────────────────────
		html.find("[name='onboard-invocation']").on("change", ev => {
			const slug    = ev.currentTarget.value;
			const checked = ev.currentTarget.checked;
			const limit   = this._rawInvocations?.startingCount ?? 2;
			if (checked) {
				if (this._selections.invocations.length < limit && !this._selections.invocations.includes(slug)) {
					this._selections.invocations.push(slug);
				} else { ev.currentTarget.checked = false; return; }
			} else {
				this._selections.invocations = this._selections.invocations.filter(s => s !== slug);
			}
			ev.currentTarget.closest(".stonetop-onboarding-card--invocation")
				?.classList.toggle("is-selected", ev.currentTarget.checked);
			html.find(".stonetop-onboarding-invocation-count").text(this._selections.invocations.length);
			const atLimit = this._selections.invocations.length >= limit;
			html.find("[name='onboard-invocation']:not(:checked)").prop("disabled", atLimit);
			_refreshNextButton();
		});

		// ── Initiates ─────────────────────────────────────────────────
		html.find("[name='onboard-initiate']").on("change", ev => {
			const slug    = ev.currentTarget.value;
			const checked = ev.currentTarget.checked;
			const bg      = this._getInitiatesData();
			const [, maxCount] = this._initiatesCountRange(bg);
			if (checked) {
				if (this._selections.initiates.length < maxCount && !this._selections.initiates.includes(slug)) {
					this._selections.initiates.push(slug);
				} else { ev.currentTarget.checked = false; return; }
			} else {
				this._selections.initiates = this._selections.initiates.filter(s => s !== slug);
			}
			ev.currentTarget.closest(".stonetop-onboarding-card--initiate")
				?.classList.toggle("is-selected", ev.currentTarget.checked);
			html.find(".stonetop-onboarding-initiate-count").text(this._selections.initiates.length);
			const atLimit = this._selections.initiates.length >= maxCount;
			html.find("[name='onboard-initiate']:not(:checked)").prop("disabled", atLimit);
			_refreshNextButton();
		});

		// ── Initiate Details ─────────────────────────────────────────
		html.find("[data-onboard-initiate-radio]").on("change", ev => {
			const { slug, rowIdx } = ev.currentTarget.dataset;
			const rowI = Number(rowIdx);
			this._selections.initiateDetails[slug] ??= {};
			const det = this._selections.initiateDetails[slug];
			const isPronoun = ev.currentTarget.dataset.isPronoun === "true";
			if (isPronoun) {
				det.pronoun = ev.currentTarget.value;
				html.find(`.onboard-initiate-custom[data-slug="${slug}"]`).val("");
			} else {
				det.rows ??= {};
				det.rows[rowI] = ev.currentTarget.value;
			}
			this._setSelectedOption(ev.currentTarget.closest(".stonetop-onboarding-initiate-options"), ev.currentTarget);
			_refreshNextButton();
		});
		html.find(".onboard-initiate-custom").on("input", ev => {
			const { slug, rowIdx } = ev.currentTarget.dataset;
			this._selections.initiateDetails[slug] ??= {};
			this._selections.initiateDetails[slug].pronoun = ev.currentTarget.value;
			html.find(`[data-onboard-initiate-radio][data-slug="${slug}"][data-row-idx="${rowIdx}"]`)
				.prop("checked", false);
			this._setSelectedOption(ev.currentTarget.closest(".stonetop-onboarding-initiate-options"));
			_refreshNextButton();
		});

		// ── Crew ──────────────────────────────────────────────────────
		html.find(".onboard-crew-name").on("input", ev => {
			this._selections.crew.name = ev.currentTarget.value;
		});

		html.find("[name='onboard-crew-tag']").on("change", ev => {
			const tag     = ev.currentTarget.value;
			const checked = ev.currentTarget.checked;
			const limit   = this._rawCrew?.additionalTagCount ?? 2;
			if (checked) {
				if (this._selections.crew.tags.length < limit && !this._selections.crew.tags.includes(tag)) {
					this._selections.crew.tags.push(tag);
				} else { ev.currentTarget.checked = false; return; }
			} else {
				this._selections.crew.tags = this._selections.crew.tags.filter(t => t !== tag);
			}
			ev.currentTarget.closest(".stonetop-onboarding-tag-option")
				?.classList.toggle("is-selected", ev.currentTarget.checked);
			html.find(".stonetop-onboarding-crew-tag-count").text(this._selections.crew.tags.length);
			const atLimit = this._selections.crew.tags.length >= limit;
			html.find("[name='onboard-crew-tag']:not([data-auto])").each((_, el) => {
				if (!el.checked) el.disabled = atLimit;
			});
			_refreshNextButton();
		});
		html.find("[name='onboard-crew-instinct']").on("change", ev => {
			this._selections.crew.instinct = ev.currentTarget.value;
			_refreshNextButton();
		});
		html.find("[name='onboard-crew-cost']").on("change", ev => {
			this._selections.crew.cost = ev.currentTarget.value;
			_refreshNextButton();
		});

		// ── Animal Companion ─────────────────────────────────────────
		html.find("[name='onboard-ac-type']").on("change", ev => {
			this._selections.animalCompanion.type   = ev.currentTarget.value;
			this._selections.animalCompanion.traits = []; // reset traits on type change
			this._selections.animalCompanion.kind   = "";
			this.render(false);
		});
		const _refreshAnimalCompanionKind = () => {
			html.find(".stonetop-onboarding-ac-kind-options .stonetop-onboarding-appearance-option")
				.removeClass("is-selected");
			html.find("[name='onboard-ac-kind']:checked")
				.closest(".stonetop-onboarding-appearance-option")
				.addClass("is-selected");
		};
		html.find("[name='onboard-ac-kind']").on("change", ev => {
			const value = ev.currentTarget.value;
			this._selections.animalCompanion.kind = value === "custom"
				? html.find(".onboard-ac-kind-custom-input").val().trim()
				: value;
			_refreshAnimalCompanionKind();
			_refreshNextButton();
		});
		html.find(".onboard-ac-kind-custom-input").on("input", ev => {
			const value = ev.currentTarget.value.trim();
			this._selections.animalCompanion.kind = value;
			html.find("[name='onboard-ac-kind'][value='custom']").prop("checked", true);
			_refreshAnimalCompanionKind();
			_refreshNextButton();
		});
		html.find("[name='onboard-ac-trait']").on("change", ev => {
			const trait   = ev.currentTarget.value;
			const checked = ev.currentTarget.checked;
			const typeData = this._rawAnimalCompanion?.types?.find(t => t.slug === this._selections.animalCompanion.type);
			const limit = typeData?.pickCount ?? 0;
			if (checked) {
				if (this._selections.animalCompanion.traits.length < limit && !this._selections.animalCompanion.traits.includes(trait)) {
					this._selections.animalCompanion.traits.push(trait);
				} else { ev.currentTarget.checked = false; return; }
			} else {
				this._selections.animalCompanion.traits = this._selections.animalCompanion.traits.filter(t => t !== trait);
			}
			ev.currentTarget.closest(".stonetop-onboarding-tag-option")
				?.classList.toggle("is-selected", ev.currentTarget.checked);
			html.find(".stonetop-onboarding-ac-trait-count").text(this._selections.animalCompanion.traits.length);
			const atLimit = this._selections.animalCompanion.traits.length >= limit;
			html.find("[name='onboard-ac-trait']:not(:checked)").prop("disabled", atLimit);
			_refreshNextButton();
		});
		html.find("[name='onboard-ac-instinct']").on("change", ev => {
			this._selections.animalCompanion.instinct = ev.currentTarget.value;
			_refreshNextButton();
		});
		html.find("[name='onboard-ac-cost']").on("change", ev => {
			this._selections.animalCompanion.cost = ev.currentTarget.value;
			_refreshNextButton();
		});
		html.find(".onboard-ac-name").on("input", ev => {
			this._selections.animalCompanion.name = ev.currentTarget.value;
		});

		// ── Lore picks ────────────────────────────────────────────────
		html.find("[name^='onboard-lore-pick-']").on("change", ev => {
			const { section, option } = ev.currentTarget.dataset;
			const key     = `${section}:${option}`;
			const checked = ev.currentTarget.checked;
			const rawSec  = this._rawLore.find(s => s.slug === section);
			const pickMax = this._parseLorePickMax(rawSec);

			if (checked) {
				const current = this._countLoreSectionPicks(section);
				if (current >= pickMax) {
					ev.currentTarget.checked = false;
					return;
				}
				this._selections.lore.picks[key] = 1;
			} else {
				this._selections.lore.picks[key] = 0;
			}

			ev.currentTarget.closest(".stonetop-onboarding-lore-pick")
				?.classList.toggle("is-selected", ev.currentTarget.checked);

			const newCount = this._countLoreSectionPicks(section);
			const atLimit  = pickMax < Infinity && newCount >= pickMax;
			html.find(`[name='onboard-lore-pick-${section}']`).each((_, el) => {
				if (!el.checked) el.disabled = atLimit;
				el.closest(".stonetop-onboarding-lore-pick")
					?.classList.toggle("stonetop-onboarding-lore-pick--disabled", !el.checked && atLimit);
			});
			html.find(".stonetop-onboarding-lore-pick-count").text(newCount);
			_refreshNextButton();
		});

		// ── Lore texts ────────────────────────────────────────────────
		html.find(".onboard-lore-text").on("input", ev => {
			const { section, option } = ev.currentTarget.dataset;
			const key = `${section}:${option}`;
			this._selections.lore.texts[key] = ev.currentTarget.value;
			_refreshNextButton();
		});

		// ── Name chips ────────────────────────────────────────────────
		html.find("[name='onboard-seeker-major-arcanum']").on("change", ev => {
			this._selections.arcana.major = ev.currentTarget.value;
			html.find("[name='onboard-seeker-major-arcanum']").each((_, el) => {
				el.closest(".stonetop-onboarding-arcana-option")
					?.classList.toggle("is-selected", el.checked);
			});
			_refreshNextButton();
		});

		html.find("[name^='onboard-seeker-minor-role-']").on("change", ev => {
			const slug = ev.currentTarget.dataset.slug;
			const role = ev.currentTarget.value;

			// Clear conflicting old assignments and uncheck their radios in the DOM.
			for (const [key, value] of Object.entries(this._selections.arcana.minorRoles)) {
				if ((key === role || value === slug) && value) {
					const old = html.find(`[name='onboard-seeker-minor-role-${value}'][value='${key}']`)[0];
					if (old) old.checked = false;
					this._selections.arcana.minorRoles[key] = "";
				}
			}
			this._selections.arcana.minorRoles[role] = slug;

			// Update is-selected on each minor card without re-rendering.
			html.find(".stonetop-onboarding-arcana-option--minor-role").each((_, el) => {
				const anyChecked = Array.from(el.querySelectorAll("input[type='radio']")).some(r => r.checked);
				el.classList.toggle("is-selected", anyChecked);
			});
			const assigned = Object.values(this._selections.arcana.minorRoles).filter(Boolean).length;
			html.find(".stonetop-onboarding-seeker-minor-count").text(assigned);
			_refreshNextButton();
		});

		html.find(".stonetop-onboarding-redraw-minor").on("click", async () => {
			const stepEl = html.find(".stonetop-onboarding-step")[0];
			const scrollTop = stepEl?.scrollTop ?? 0;
			const arcana = await this._loadArcanaOptions();
			this._drawSeekerMinorArcana(arcana.minor);
			await this.render(false);
			if (stepEl) stepEl.scrollTop = scrollTop;
		});

		html.find(".onboard-name-chip").on("click", ev => {
			const name = ev.currentTarget.dataset.name;
			this._selections.name = name;
			html.find(".onboard-name-input").val(name);
			_refreshNextButton();
		});

		// ── Arcana preview tooltips (fixed-position to escape modal overflow) ──
		html.find(".stonetop-onboarding-arcana-option")
			.on("mouseenter", ev => this._showArcanaPreview(ev.currentTarget))
			.on("mouseleave", () => this._removeArcanaPreview());

		// ── FAQ badge: hover shows this step's questions, click opens the full FAQ ──
		html.find(".stonetop-onboarding-faq-badge")
			.on("mouseenter", ev => this._showFaqPopup(ev.currentTarget))
			.on("mouseleave", () => this._scheduleFaqPopupHide())
			.on("click", () => this._openFaqPage());

		// ── Move cross-references + bold-word hover tooltips ───────────
		// Wrap basic-move names wherever they sit in a card's text — leading ("Know
		// Things about beasts …") or mid-phrase ("… roll a 12+ to Clash …") — so the
		// move name itself becomes the hover target, matching the character sheet. The
		// span's text is exactly the move name, which _lookupWord resolves by exact
		// match, so the shared bold-word binding handles it without a separate path.
		html.find(".stonetop-onboarding-card-desc").each((_, el) => {
			if (el.dataset.moveRefsEnriched) return;
			el.dataset.moveRefsEnriched = "1";
			enrichMoveRefsInEl(el);
		});

		const bindWordTooltip = (el) => {
			if (el.dataset.tooltipBound) return;
			el.dataset.tooltipBound = "1";
			el.classList.add("stonetop-onboarding-lookup");
			el.addEventListener("mouseenter", async ev => {
				const anchor = ev.currentTarget;
				this._hoveredAnchor = anchor;
				const text = anchor.textContent.trim();
				const description = await this._lookupWord(text);
				if (this._hoveredAnchor !== anchor) return;
				if (description) this._showWordTooltip(anchor, text, description);
			});
			el.addEventListener("mouseleave", () => {
				this._hoveredAnchor = null;
				this._removeTooltip();
			});
		};

		html.find(".stonetop-onboarding-lookup").each((_, el) => bindWordTooltip(el));
		html.find(".stonetop-move-ref").each((_, el) => bindWordTooltip(el));

		const pendingLookups = [];
		html.find(".stonetop-onboarding-card-desc strong").each((_, el) => {
			if (el.querySelector(".stonetop-move-ref")) return; // inner move-ref span handles it
			const text = el.textContent.trim();
			const key = text.toLowerCase();
			const cached = this._wordCache.get(key);
			if (cached) {
				bindWordTooltip(el);
			} else if (cached !== null) {
				pendingLookups.push([el, text]);
			}
		});

		void Promise.all(pendingLookups.map(async ([el, text]) => {
			const description = await this._lookupWord(text);
			if (description && el.isConnected) bindWordTooltip(el);
		}));

		_refreshNextButton();
	}

	// ── Shared DOM helpers ────────────────────────────────────────────

	_setSelectedOption(container, selectedEl = null) {
		if (!container) return;
		container.querySelectorAll(".stonetop-onboarding-appearance-option")
			.forEach(el => el.classList.remove("is-selected"));
		selectedEl?.closest(".stonetop-onboarding-appearance-option")?.classList.add("is-selected");
	}

	// ── Navigation ────────────────────────────────────────────────────

	_clearPopups() {
		this._removeTooltip();
		this._removeArcanaPreview();
		this._removeFaqPopup();
		StonetopAutocomplete.close();
	}

	// Scrollable suggestion popup for the background "neighbor trait" inputs (e.g. the
	// Ranger's Wide Wanderer) — see utils/autocomplete.js for why the native <datalist>
	// can't be used. A fresh render replaces the inputs, so drop any stale popup first.
	_attachTraitAutocomplete(html) {
		StonetopAutocomplete.close();
		html.find(".onboard-background-neighbor-trait")
			.each((_, input) => StonetopAutocomplete.attach(input, STEADING_NPC_TRAITS));
	}

	async _goBack() {
		this._clearPopups();
		// Returning to the picker is navigation, not an exit — don't let the close
		// trigger the "open the finished sheet" callback.
		this._suppressOnClose = true;
		await this.close();
		if (this._onBack) this._onBack();
	}

	async _skip() {
		this._clearPopups();
		const next = this._step + 1;
		if (next >= this._steps.length) {
			this._completed = true;
			if (this._onComplete) await this._onComplete(this._selections);
			this.close();
			return;
		}
		this._step = next;
		this.render(false);
	}

	_navigate(dir) {
		this._clearPopups();
		if (dir > 0 && !this._isStepComplete()) return;
		const next = this._step + dir;
		if (next < 0 || next >= this._steps.length) return;
		this._step = next;
		this.render(false);
	}

	async _confirm() {
		if (!this._isStepComplete()) return;
		this._completed = true;
		if (this._onComplete) await this._onComplete(this._selections);
		this.close();
	}

	async _saveProgress() {
		this._clearPopups();
		if (this._onSave) await this._onSave(this._selections);
		new Dialog({
			title: game.i18n.localize("stonetop.onboarding.savedTitle"),
			content: `<p>${game.i18n.localize("stonetop.onboarding.savedContent")}</p>`,
			buttons: {
				close: {
					label: game.i18n.localize("stonetop.onboarding.closeForNow"),
					callback: () => this.close(),
				},
				continue: {
					label: game.i18n.localize("stonetop.onboarding.continueEditing"),
				},
			},
			default: "continue",
		}, {
			classes: ["dialog", "stonetop", "stonetop-onboarding-child-dialog"],
		}).render(true);
	}

	async close(options) {
		this._frontOnOpen.stop();
		this._clearPopups();
		// Cancel any debounced live-save; the current answers are captured below
		// (onExit) or were already committed (onComplete), and a late timer could
		// otherwise re-stamp a flag the completion just cleared.
		clearTimeout(this._snapshotSaveTimer);
		const result = await super.close(options);
		if (!this._suppressOnClose) {
			// Closed without finishing (and not heading back to the picker) → exited.
			// Hand over the snapshot so the resume flow keeps the player's place.
			if (this._onExit && !this._completed) this._onExit(this._progressInfo());
			if (this._onClose) this._onClose();
		}
		return result;
	}

	// ── Word tooltip ──────────────────────────────────────────────────

	_removeTooltip() {
		document.querySelector(".stonetop-word-tooltip")?.remove();
	}

	_removeArcanaPreview() {
		document.querySelector(".stonetop-arcana-preview-popup")?.remove();
	}

	// ── FAQ popup ─────────────────────────────────────────────────────
	// Hovering the corner badge surfaces the FAQ entries relevant to the current
	// step (computed in getData → this._currentFaq). The popup is interactive so a
	// reader can move into it and scroll long answers; a short hide delay bridges
	// the gap between badge and popup.

	_removeFaqPopup() {
		clearTimeout(this._faqPopupHideTimer);
		this._faqPopupHideTimer = null;
		document.querySelector(".stonetop-onboarding-faq-popup")?.remove();
	}

	_scheduleFaqPopupHide() {
		clearTimeout(this._faqPopupHideTimer);
		this._faqPopupHideTimer = setTimeout(() => this._removeFaqPopup(), 200);
	}

	_showFaqPopup(anchor) {
		clearTimeout(this._faqPopupHideTimer);
		this._faqPopupHideTimer = null;
		this._removeFaqPopup();
		if (!this._currentFaq?.length) return;
		const popup = document.createElement("div");
		popup.className = "stonetop-onboarding-faq-popup";
		popup.innerHTML =
			`<p class="stonetop-onboarding-faq-popup-title">Related questions</p>` +
			`<div class="stonetop-onboarding-faq-popup-body">${this._currentFaq.map(i => i.html).join("")}</div>` +
			`<p class="stonetop-onboarding-faq-popup-more">Click the <i class="fas fa-circle-question"></i> for the full FAQ</p>`;
		// Spiral bullet beside each Q&A, matching the full FAQ journal page.
		markFaqItems(popup);
		// Redraw the ◇/◆ load glyphs as the masked, theme-aware spans the journal
		// uses (CSS scoped to .stonetop-onboarding-faq-popup-body), so the answer to
		// "What do ◇ and ◇◇ mean?" doesn't show raw, unstyled Unicode diamonds.
		wrapStonetopGlyphsInEl(popup);
		// Give the weapon/gear tags in "What do the various tags mean?" the same hover
		// descriptions they get everywhere else (range/fiction cues), matching the journal.
		applyGearTermTooltips(popup);
		// Keep the popup open while the pointer is over it, so it can be read/scrolled.
		popup.addEventListener("mouseenter", () => {
			clearTimeout(this._faqPopupHideTimer);
			this._faqPopupHideTimer = null;
		});
		popup.addEventListener("mouseleave", () => this._scheduleFaqPopupHide());
		this._positionPopup(popup, anchor, { align: "right", gap: 8, placement: "below" });
	}

	// Open the seeded "Character Creation FAQ" journal page, or warn if it isn't
	// available in this world yet (e.g. the Setting Overview hasn't been seeded).
	// Opened via openJournalSheetAsChild so it's brought to the front on top of
	// this dialog when it appears.
	_openFaqPage() {
		this._clearPopups();
		const page = faqPage();
		if (!page) {
			ui.notifications?.warn("The Character Creation FAQ isn't set up in this world yet.");
			return;
		}
		const sheet = page.parent?.sheet;
		if (!sheet) return;
		openJournalSheetAsChild(sheet, {
			childClass:    "stonetop-onboarding-child-dialog",
			renderOptions: { pageId: page.id },
		});
	}

	_showArcanaPreview(anchor) {
		this._removeArcanaPreview();
		const source = anchor.querySelector(".stonetop-onboarding-arcana-preview");
		if (!source?.children.length) return;
		const popup = document.createElement("div");
		popup.className = "stonetop-arcana-preview-popup";
		popup.innerHTML = source.innerHTML;
		// Drop the preview just below the hovered card (these grids sit near the top of
		// their step); flips above only if it would run off the bottom of the viewport.
		this._positionPopup(popup, anchor, { align: "center", gap: 8, placement: "below" });
	}

	_showWordTooltip(anchor, text, description) {
		this._removeTooltip();
		const tip = document.createElement("div");
		tip.className = "stonetop-word-tooltip";
		tip.innerHTML =
			`<p class="stonetop-word-tooltip-name">${text}</p>` +
			`<div class="stonetop-word-tooltip-desc">${description}</div>`;
		this._positionPopup(tip, anchor, { gap: 6, placement: "above" });
	}

	// `placement` is the preferred side ("above" | "below"); the popup flips to the
	// other side only if the preferred one would run off the viewport edge.
	_positionPopup(el, anchor, { align = "left", gap = 6, placement = "above" } = {}) {
		document.body.appendChild(el);
		const ar = anchor.getBoundingClientRect();
		// Use offset dimensions, not getBoundingClientRect: the arcana popup's grow-in
		// animation starts at scale(0.4), which would shrink the measured rect and throw
		// off placement. offsetWidth/Height report the untransformed layout box.
		const pw = el.offsetWidth;
		const ph = el.offsetHeight;
		const above = ar.top - ph - gap;
		const below = ar.bottom + gap;
		let top  = placement === "below"
			? (below + ph > window.innerHeight - 8 ? above : below)
			: (above < 8 ? below : above);
		let left = align === "center"
			? ar.left + ar.width / 2 - pw / 2
			: align === "right"
				? ar.right - pw
				: ar.left;
		top  = Math.max(8, top);
		left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
		el.style.top  = `${top}px`;
		el.style.left = `${left}px`;
		const dialogZ = parseInt(this.element?.[0]?.style?.zIndex || 0);
		el.style.setProperty("z-index", String(Math.max(10000, dialogZ + 2)), "important");
	}

	async _lookupWord(text) {
		const key = text.toLowerCase();
		if (this._wordCache.has(key)) return this._wordCache.get(key);
		const packs = game.packs.filter(
			p => p.metadata.packageName === "stonetop" && p.metadata.type === "Item"
		);
		for (const pack of packs) {
			await pack.getIndex();
			const entry = pack.index.find(e => e.name.toLowerCase() === key);
			if (!entry) continue;
			const doc  = await pack.getDocument(entry._id);
			const desc = doc?.system?.description ?? null;
			this._wordCache.set(key, desc);
			return desc;
		}
		this._wordCache.set(key, null);
		return null;
	}
}
