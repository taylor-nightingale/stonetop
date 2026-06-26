import { FrontOnOpen } from "../utils/front-on-open.js";
import { shuffle } from "../utils/arrays.js";
import { stonetopSteadingHeaderButton } from "../utils/world.js";
import { playbookSlug, getPlayerCharacters, playbookIconPath, orderByCombatTurns } from "../utils/playbook-actors.js";
import { wrapLoreTerms } from "../utils/lore-terms.js";
// Authored prompts/questions live in introductions-data.js so the Chronicle
// compiler can resolve a recorded answer's question index back to its text.
import { INTRO_PLAYBOOK_DATA as _PLAYBOOK_DATA } from "./introductions-data.js";
import { saveChronicleFromButton } from "../utils/chronicle.js";
import { getSetting, setSetting } from "../settings.js";
import { getWalkthroughResume, patchWalkthroughResume, markWalkthroughDone } from "./walkthrough-resume.js";

// The world setting holding the answers recorded during the introductions, keyed
// by actor id → { r1, r2, r3 (strings); r4–r7 ({ q, a }) }. Compiled into the
// Chronicle journal by utils/chronicle.js. See settings.js for the full shape.
const _ANSWERS_SETTING = "introductionsAnswers";

// Key for this dialog's reload-resume record (round + turn + open flag) in the
// shared walkthroughResume setting. See walkthrough-resume.js.
const _RESUME_KEY = "introductions";

// Rounds that draw from the same question list ("go around again"): 4 & 5 share
// the step-4 prompts, 6 & 7 share step-6. Used to gray out a prompt a PC already
// answered/asked in the paired round.
const _SIBLING_ROUND = { 4: 5, 5: 4, 6: 7, 7: 6 };

// Placeholder copy for the narration rounds (1–3); rounds 4–7 set their own from
// whether the PC is answering or asking.
const _NARRATE_PLACEHOLDER = {
	1: "Name, pronouns, background, origin, appearance…",
	2: "Their special possessions, and how they help the village…",
	3: "Their answer…",
};

// ── Phase definitions ─────────────────────────────────────────────────────────
// Index matches round number (1-8). Index 0 unused (phase 0 = pre-check).

const _PHASES = [
	null,
	{
		roundRobin: true,
		getInstruction: () => `On your <strong>first turn</strong>, <strong>introduce yourself</strong>: your name, pronouns, background, origin, and appearance.`,
		getQuestions:   () => null,
	},
	{
		roundRobin: true,
		getInstruction: () => `On your <strong>second turn</strong>, <strong>describe your special possessions</strong> and how you contribute to the village (beyond working the fields).`,
		getQuestions:   () => null,
	},
	{
		roundRobin: true,
		getInstruction: (pc) => {
			const d = _PLAYBOOK_DATA[playbookSlug(pc)];
			return d
				? `On your <strong>third turn</strong>, ${d.step3}`
				: `On your <strong>third turn</strong>, tell us something about your character and their place in Stonetop.`;
		},
		getQuestions: () => null,
	},
	{
		roundRobin: true,
		getInstruction: () => `On your <strong>next turn</strong>, <strong>answer one of the following</strong>, naming one or more NPCs who live in Stonetop.`,
		getQuestions:   (pc) => _PLAYBOOK_DATA[playbookSlug(pc)]?.step4 ?? null,
	},
	{
		roundRobin: true,
		getInstruction: () => `<strong>Go around again.</strong> Answer another question from round 4, or pass. When everyone has passed, go on.`,
		getQuestions:   (pc) => _PLAYBOOK_DATA[playbookSlug(pc)]?.step4 ?? null,
	},
	{
		roundRobin: true,
		getInstruction: () => `On your <strong>next turn</strong>, <strong>ask your fellow PCs one of these</strong>. When others ask you, answer as you like.`,
		getQuestions:   (pc) => _PLAYBOOK_DATA[playbookSlug(pc)]?.step6 ?? null,
	},
	{
		roundRobin: true,
		getInstruction: () => `<strong>Go around again.</strong> Ask another question from round 6, or pass. When everyone has passed, go on.`,
		getQuestions:   (pc) => _PLAYBOOK_DATA[playbookSlug(pc)]?.step6 ?? null,
	},
	{
		roundRobin: false,
		getInstruction: () => `<strong>Add each player's home</strong> to Stonetop's Places of Interest. When everyone is done, <strong>let spring break forth!</strong><span class="stonetop-intros-instruction-note">Players can reach the Stonetop playbook by hitting the <strong>Stonetop</strong> button in the navbar of their character sheet.</span>`,
		getQuestions:   () => null,
	},
];

// ── Helpers ───────────────────────────────────────────────────────────────────

// Player characters on the combat tracker, in the GM's arranged turn order; [] before
// a combat is set up. Resolves to roster actors so the ids line up with
// getPlayerCharacters() (getData compares the two by id).
function _getCombatPcs() {
	return orderByCombatTurns(getPlayerCharacters());
}

// ── IntroductionsDialog ───────────────────────────────────────────────────────

export class IntroductionsDialog extends Application {
	constructor(options = {}) {
		super(options);
		this._phase       = 0;
		this._pcIndex     = 0;
		this._pcs         = [];
		this._frontOnOpen   = new FrontOnOpen(this);
		this._combatHooks = null;
	}

	// Entry point used by the macro: auto-populate the Combat Tracker with every
	// playbook-bearing character, then show the dialog.
	static async open() {
		const dialog = new IntroductionsDialog();
		try {
			await dialog.ensureCombatRoster();
		} catch (err) {
			console.error("Stonetop | Introductions: failed to set up the combat tracker", err);
		}
		// Resume where this user left off before a reload (combat is set up first so
		// the resumed round-robin has its PC list).
		dialog._restorePosition();
		return dialog.render(true);
	}

	// Ensure an active combat exists and every player character (any actor with a
	// playbook) is in it. Only the GM can mutate combat, so this is a no-op for
	// players — they just see whatever the GM has already set up.
	async ensureCombatRoster() {
		if (!game.user?.isGM) return;

		const actors = getPlayerCharacters();
		if (!actors.length) return;

		let combat = game.combat;
		if (!combat) {
			const CombatCls = getDocumentClass("Combat");
			combat = await CombatCls.create({ scene: canvas?.scene?.id ?? null });
			await combat?.activate?.();
		}
		if (!combat) return;

		const present = new Set(combat.combatants.map(c => c.actorId));
		const toAdd   = actors.filter(a => !present.has(a.id));
		if (!toAdd.length) return;

		await combat.createEmbeddedDocuments("Combatant", toAdd.map(a => ({
			actorId: a.id,
			name:    a.name,
			img:     a.img,
		})));
	}

	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id:        "stonetop-introductions",
			title:     "Character Introductions",
			template:  "systems/stonetop/templates/dialogs/introductions.hbs",
			width:     520,
			height:    "auto",
			resizable: true,
			classes:   ["stonetop", "stonetop-introductions"],
		});
	}

	async _render(force, options) {
		await super._render(force, options);
		this._frontOnOpen.apply();
		// Record where we are + that we're open, so a reload can reopen here. Every
		// render reflects the current round/turn (navigation always re-renders).
		this._saveResume();
	}

	// GM-only "Stonetop" shortcut in the window header — mirrors the steading button
	// on the character sheet header (StonetopCharacterSheet._getHeaderButtons) — so the
	// GM can jump to the steading's Places of Interest while running introductions.
	// Players are pointed to their own sheet's button by the final-round note.
	_getHeaderButtons() {
		const buttons = super._getHeaderButtons();
		if (game.user?.isGM) buttons.unshift(stonetopSteadingHeaderButton());
		return buttons;
	}

	activateListeners(html) {
		super.activateListeners(html);
		this._frontOnOpen.start();
		html.find(".stonetop-intros-add").on("click", async () => {
			await this.ensureCombatRoster();
			this.render(false);
		});
		html.find(".stonetop-intros-shuffle").on("click", () => this._shuffleOrder());
		html.find(".stonetop-intros-begin").on("click", () => this._begin());
		html.find(".stonetop-intros-next").on("click",  () => this._advance());
		html.find(".stonetop-intros-back").on("click",  () => this._retreat());
		html.find(".stonetop-intros-close").on("click", ev => this._finish(ev.currentTarget));

		// Record the active PC's answer. The narration rounds (1–3) store a plain
		// string; the question rounds (4–7) store the answer under `a`. Save on
		// change (blur) so the textarea keeps focus while typing — clicking any nav
		// or question button blurs first, firing this before the click handler.
		html.find(".stonetop-intros-answer").on("change", ev => {
			const el    = ev.currentTarget;
			const value = el.dataset.answerField ? { [el.dataset.answerField]: el.value } : el.value;
			this._saveAnswer(el.dataset.actorId, el.dataset.roundKey, value);
		});
		// Pick (or toggle off) which question the PC answered/asked, then re-render
		// to move the highlight.
		html.find(".stonetop-intros-question-pick").on("click", async ev => {
			const el      = ev.currentTarget;
			const idx     = Number(el.dataset.qIndex);
			const current = this._answers()[el.dataset.actorId]?.[el.dataset.roundKey]?.q;
			await this._saveAnswer(el.dataset.actorId, el.dataset.roundKey, { q: current === idx ? null : idx });
			this.render(false);
		});

		this._registerCombatHooks();
	}

	// The recorded answers blob. The GM (the only writer) edits through an in-memory
	// draft so rapid successive saves — e.g. an answer textarea blurring just as a
	// question button is clicked — compose synchronously instead of racing the async
	// world-settings write; players read the persisted value fresh each render.
	_answers() {
		if (game.user?.isGM) return (this._draft ??= { ...(getSetting(_ANSWERS_SETTING) ?? {}) });
		return getSetting(_ANSWERS_SETTING) ?? {};
	}

	// Persist one answer without re-rendering (so a focused textarea keeps focus).
	// `value` is a string for the narration rounds, or a `{ q }` / `{ a }` partial
	// for the question rounds (merged into that round's record). Mutates the draft
	// in place first so the next handler sees it, then flushes to the setting.
	async _saveAnswer(actorId, roundKey, value) {
		if (!actorId || !roundKey) return;
		const all = this._answers();
		all[actorId] = {
			...(all[actorId] ?? {}),
			[roundKey]: (value && typeof value === "object")
				? { ...(all[actorId]?.[roundKey] ?? {}), ...value }
				: value,
		};
		await setSetting(_ANSWERS_SETTING, all);
	}

	// Compile everything recorded so far (plus the Spring Burst notes) into the
	// shared "Chronicle" journal and open it. GM-only — the button is hidden for
	// players, who read the journal once it's shared. Flush the draft first so the
	// compiler (which reads the persisted setting) sees the latest edits.
	async _saveChronicle(button) {
		return saveChronicleFromButton(button, {
			context:    "Introductions",
			beforeSave: () => (this._draft ? setSetting(_ANSWERS_SETTING, this._draft) : undefined),
		});
	}

	// "Let spring break forth!" — the final button now also commits everything
	// recorded to the Chronicle (GM only; there's no separate save step) before the
	// dialog closes. Players just close. If the save errors, keep the dialog open so
	// the GM can fix it and try again rather than losing the closing action.
	async _finish(button) {
		if (game.user?.isGM && !(await this._saveChronicle(button))) return;
		// Mark the run finished (drops the saved round/turn so a manual reopen starts at
		// the pre-check) — this is half of what stops the Welcome guide auto-opening once
		// spring's also burst forth. close() then re-stamps open:false.
		markWalkthroughDone(_RESUME_KEY, ["phase", "pcIndex"]);
		return this.close();
	}

	_registerCombatHooks() {
		if (this._combatHooks) return;
		const refresh = () => { if (this._phase === 0) this.render(false); };
		this._combatHooks = [
			["createCombat",    Hooks.on("createCombat",    refresh)],
			["deleteCombat",    Hooks.on("deleteCombat",    refresh)],
			["createCombatant", Hooks.on("createCombatant", refresh)],
			["deleteCombatant", Hooks.on("deleteCombatant", refresh)],
		];
	}

	_unregisterCombatHooks() {
		if (!this._combatHooks) return;
		for (const [name, id] of this._combatHooks) Hooks.off(name, id);
		this._combatHooks = null;
	}

	async close(options = {}) {
		this._unregisterCombatHooks();
		this._frontOnOpen.stop();
		// Closing on purpose (the X or "Let spring break forth!") clears the open flag
		// so we don't auto-reopen on the next load; a browser reload skips close() and
		// leaves it set. The saved round/turn stays, so a manual reopen still resumes.
		patchWalkthroughResume(_RESUME_KEY, { open: false });
		return super.close(options);
	}

	getData() {
		const allPcs    = getPlayerCharacters();
		const combatPcs = _getCombatPcs();
		const combatIds = new Set(combatPcs.map(a => a.id));
		const missing   = allPcs.filter(a => !combatIds.has(a.id));

		if (this._phase === 0) {
			const isGM = game.user?.isGM ?? false;
			return {
				isPreCheck:   true,
				isGM,
				canShuffle:   isGM && combatPcs.length > 1,
				canBegin:     combatPcs.length > 0,
				hasNone:      allPcs.length === 0,
				noneInCombat: allPcs.length > 0 && combatPcs.length === 0,
				hasMissing:   missing.length > 0,
				missingPcs:   missing.map(a => a.name),
				pcNames:      combatPcs.map(a => a.name),
				pcCount:      combatPcs.length,
			};
		}

		const isGM  = game.user?.isGM ?? false;
		const pcs   = this._pcs;
		const phase = _PHASES[this._phase];
		const actor = phase.roundRobin ? (pcs[this._pcIndex] ?? null) : null;

		let currentPc = null;
		let capture   = null;
		let questions = null;
		if (phase.roundRobin && actor) {
			const slug = playbookSlug(actor);
			currentPc = {
				name:         actor.name,
				playbookName: actor.system?.playbook?.name ?? "",
				icon:         playbookIconPath(slug),
				index:        this._pcIndex + 1,
				total:        pcs.length,
			};

			// Recorded answer for this PC's turn. Rounds 1–3 store a plain string;
			// rounds 4–7 store { q, a } — the chosen question index and the answer.
			const roundKey = `r${this._phase}`;
			const stored   = this._answers()[actor.id]?.[roundKey];
			const isAsk    = this._phase >= 6;          // rounds 6–7 ask fellow PCs
			const isAnswer = this._phase === 4 || this._phase === 5;

			if (isAnswer || isAsk) {
				const selectedQ = Number.isInteger(stored?.q) ? stored.q : null;
				// Gray out the prompt this PC already used in the paired round (4&5
				// share the step-4 list; 6&7 share step-6) so they can't answer/ask
				// the same one twice — except the one selected this turn, which stays
				// pickable so the GM can toggle it back off.
				const siblingKey = _SIBLING_ROUND[this._phase];
				const siblingQ   = siblingKey ? this._answers()[actor.id]?.[`r${siblingKey}`]?.q : null;
				// Mark the chosen prompt so the GM (and read-only players) see which
				// question this answer responded to. (A non-integer/absent siblingQ can
				// never equal a real prompt index, so no extra guard is needed.)
				questions = (phase.getQuestions(actor) ?? []).map((html, index) => ({
					index,
					html:       wrapLoreTerms(html),
					isSelected: index === selectedQ,
					isUsed:     index === siblingQ && index !== selectedQ,
				}));
				capture = {
					isQuestion:  true,
					actorId:     actor.id,
					key:         roundKey,
					answer:      typeof stored?.a === "string" ? stored.a : "",
					placeholder: isAsk ? "Who you asked, and what they answered…" : "Their answer…",
					canEdit:     isGM,
				};
			} else {
				capture = {
					isQuestion:  false,
					actorId:     actor.id,
					key:         roundKey,
					answer:      typeof stored === "string" ? stored : "",
					placeholder: _NARRATE_PLACEHOLDER[this._phase] ?? "Their answer…",
					canEdit:     isGM,
				};
			}
		}

		// Add hover summaries to bare god names (Danu / Aratis / Helior) in the
		// authored prompts; move names are intentionally left alone.
		const instruction = wrapLoreTerms(phase.getInstruction(actor));
		const isLastPc    = !phase.roundRobin || this._pcIndex >= pcs.length - 1;
		const isDone      = this._phase === 8 && isLastPc;

		return {
			isPreCheck:    false,
			isGM,
			phase:         this._phase,
			currentPc,
			instruction,
			questions,
			hasQuestions:  !!(questions?.length),
			capture,
			stepLabel:     `Round ${this._phase} of 8`,
			isPrevDisabled: this._phase === 1 && this._pcIndex === 0,
			isDone,
		};
	}

	// Randomize the round-robin order. We express the new order as descending
	// initiative on the PC combatants, so both the Combat Tracker and the dialog's
	// turn order (which reads `combat.turns`) reflect the shuffle.
	async _shuffleOrder() {
		const combat = game.combat;
		if (!combat || !game.user?.isGM) return;

		const pcs = _getCombatPcs();
		if (pcs.length < 2) return;

		const ids = pcs.map(a => a.id);
		let order = shuffle(ids);
		// Re-roll a few times if the shuffle happened to land on the same order.
		let guard = 0;
		while (order.every((id, i) => id === ids[i]) && guard++ < 10) order = shuffle(ids);

		const updates = [];
		order.forEach((actorId, idx) => {
			const c = combat.combatants.find(cb => cb.actorId === actorId);
			if (c) updates.push({ _id: c.id, initiative: order.length - idx });
		});
		if (updates.length) await combat.updateEmbeddedDocuments("Combatant", updates);
		this.render(false);
	}

	_begin() {
		this._pcs     = _getCombatPcs();
		this._phase   = 1;
		this._pcIndex = 0;
		this.render(false);
	}

	// In the question rounds (4–7) a recorded answer has to name the prompt it
	// responds to, so the Chronicle knows what was answered/asked. Passing (no
	// answer recorded) is still fine. GM-only — players just follow along read-only.
	_requireQuestionForAnswer() {
		if (!game.user?.isGM) return true;
		if (!(this._phase >= 4 && this._phase <= 7)) return true;
		const actor = this._pcs[this._pcIndex];
		if (!actor) return true;
		const stored      = this._answers()[actor.id]?.[`r${this._phase}`];
		const hasAnswer   = typeof stored?.a === "string" && stored.a.trim() !== "";
		const hasQuestion = Number.isInteger(stored?.q);
		if (hasAnswer && !hasQuestion) {
			ui.notifications?.warn("Tap the question they chose before moving on, so it's recorded with their answer.");
			return false;
		}
		return true;
	}

	_advance() {
		if (!this._requireQuestionForAnswer()) return;
		const phase = _PHASES[this._phase];
		if (phase?.roundRobin && this._pcIndex < this._pcs.length - 1) {
			this._pcIndex++;
		} else if (this._phase < 8) {
			this._phase++;
			this._pcIndex = 0;
		}
		this.render(false);
	}

	_retreat() {
		if (this._phase === 0) return;
		const phase = _PHASES[this._phase];
		if (phase?.roundRobin && this._pcIndex > 0) {
			this._pcIndex--;
		} else if (this._phase > 1) {
			this._phase--;
			const prev = _PHASES[this._phase];
			this._pcIndex = prev.roundRobin ? this._pcs.length - 1 : 0;
		} else {
			// Back to pre-check from round 1, first PC
			this._phase   = 0;
			this._pcIndex = 0;
		}
		this.render(false);
	}

	// Resume the round/turn saved before a reload (the dialog doesn't survive a
	// refresh). No-op when nothing's saved or no PCs are on the tracker — both leave
	// the dialog on the pre-check screen.
	_restorePosition() {
		const saved = getWalkthroughResume(_RESUME_KEY);
		const phase = Number(saved?.phase);
		if (!Number.isInteger(phase) || phase < 1 || phase > 8) return;
		const pcs = _getCombatPcs();
		if (!pcs.length) return;
		this._pcs     = pcs;
		this._phase   = phase;
		const maxIdx  = _PHASES[phase].roundRobin ? pcs.length - 1 : 0;
		const idx     = Number(saved?.pcIndex);
		this._pcIndex = Number.isInteger(idx) ? Math.min(Math.max(idx, 0), maxIdx) : 0;
	}

	// Persist the current round/turn (and that we're open) so a reload can reopen
	// here. Fire-and-forget client-scoped write; guarded so same-spot re-renders
	// don't re-write.
	_saveResume() {
		const cur = getWalkthroughResume(_RESUME_KEY);
		if (cur?.open === true && cur.phase === this._phase && cur.pcIndex === this._pcIndex) return;
		patchWalkthroughResume(_RESUME_KEY, { open: true, phase: this._phase, pcIndex: this._pcIndex });
	}
}
