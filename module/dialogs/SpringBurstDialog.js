import { StepperDialog } from "./StepperDialog.js";
import { openOrFocus } from "../utils/open-or-focus.js";
import { postSeasonsRollPrompt, SPRING_SEASONS_RESULT } from "../utils/roll-engine.js";
import { escHtml } from "../utils/strings.js";
import { getPlayerCharacters } from "../utils/playbook-actors.js";
import { setSetting } from "../settings.js";
import { postSeasonsChangeReminder } from "../seasons/seasons-change-reminders.js";
import { recordSeasonsChange } from "../seasons/seasons-chronicle.js";
import { getWalkthroughResume, patchWalkthroughResume, markWalkthroughDone } from "./walkthrough-resume.js";
import { saveChronicleFromButton } from "../utils/chronicle.js";
import { SEASONAL_GAINS } from "./spring-burst-data.js";

const ANSWERS_SETTING = "springBurstAnswers";

// Key for this dialog's reload-resume record (step + open flag) in the shared
// walkthroughResume setting. See walkthrough-resume.js.
const RESUME_KEY = "springBurst";

// ── SpringBurstDialog ──────────────────────────────────────────────────────────
// A GM-only walkthrough of Book I's final "Getting Started" step, "Let spring
// burst forth" (Book I, p.32). It picks up where the guided Introductions leave
// off: find the most hopeful PC, make the season's first Seasons Change move, read
// the result for a plot hook, then wrap up the session. Step 3 hands the roll to the
// table — it posts a chat card asking the most hopeful PC's player to roll +Fortunes
// (+1 this first spring), so the result lands in chat rather than the dialog. Opened
// from the combined introductions/spring-burst step of the WelcomeDialog (see
// templates/dialogs/welcome.hbs).

// Fortunes is +1 for this first spring (Book I, p.32: "roll +Fortunes (+1, in this
// case)"). Later seasons read it off the steading, but the first-session guide is
// always this opening roll.
const FIRST_SPRING_FORTUNES = 1;

// The same three tiers, framed for the GM running the first session: you're
// fishing for a plot hook, not just any seasonal gain (Book I, p.32). The tier
// label ("10+" etc.) comes from SPRING_SEASONS_RESULT so it's only written once.
const _OMEN_TIERS = [
	{
		key:  "success",
		text: "Pick a gain that hands you a <strong>hook</strong>: <strong>Interesting news</strong>, <strong>Valuable insight</strong>, or a <strong>Trade opportunity</strong>. (Tor's blessing, an unexpected bounty, and the like don't give you one.)",
	},
	{
		key:  "partial",
		text: "They pick whatever gain they like &mdash; you'll pair it with a <strong>threat</strong> to the steading to build your starting situation.",
	},
	{
		key:  "failure",
		text: "Chuckle grimly and <strong>start thinking about threats</strong>.",
	},
];

// Linear walkthrough. `body` is rendered as HTML; `icon` is a Font Awesome class.
const _STEPS = [
	{
		key:   "spring",
		title: "Spring bursts forth",
		icon:  "fa-seedling",
		body:  `<p>The introductions are done and the maps are marked. Tell the players that <strong>spring has just broken forth upon the land</strong> &mdash; the snows recede, the soil softens, and Stonetop stirs to life.</p>
				<p>This last step turns everything they've given you into the seed of your first adventure.</p>`,
	},
	{
		// One screen for the whole Seasons Change move — the same content as the
		// steading's Seasons Change modal: the players name the most hopeful character
		// (no field needed), hand them the roll, read the omen, and tick what they pick.
		// The wrap-up note lands in `footer`, below the hook field. Next → "One last
		// question".
		key:      "roll",
		title:    "Make the Seasons Change move",
		icon:     "fa-dice",
		showRoll:  true,
		showTiers: true,
		showGains: true,
		body:     `<p>The players decide together <strong>whose character is the most hopeful</strong>; that character makes the <strong>Seasons Change</strong> move (under <em>Homefront Moves</em> on the Moves &amp; Gear handout): they <strong>roll +Fortunes</strong>, which is <strong>+1</strong> this first spring.</p>
				<p>You're looking for a <strong>plot hook</strong> &mdash; read the omen for what each result hands you, and tick whatever gain they pick.</p>`,
		qa:       {
			kind:        "single",
			key:         "hook",
			prompt:      "What hook does it open &mdash; the thread for your first adventure?",
			placeholder: "Opportunities or threats…",
		},
		footer:   `<p>Note the result and update the steading playbook if needed, then <strong>start to wrap up</strong>. It'll be tempting to leap straight into play &mdash; <strong>don't</strong>; give yourself time to mull over everything the players handed you and to prepare the first expedition.</p>`,
	},
	{
		key:   "question",
		title: "One last question",
		icon:  "fa-comment-dots",
		body:  `<p>Before everyone goes, ask each player:</p>
				<blockquote>What excites you the most about playing your character?</blockquote>
				<p>Whatever they tell you, <strong>write it down</strong> &mdash; and try to work it into the first adventure.</p>`,
		qa:    {
			kind:        "perPc",
			key:         "excites",
			prompt:      name => `What excites you most about playing <strong>${name}</strong>?`,
			placeholder: "What they told you…",
			empty:       "Create your characters first to record this per character.",
		},
	},
	{
		key:     "after",
		title:   "After the session",
		icon:    "fa-feather",
		isFinal: true,
		body:    `<p>Once you've broken up for the night, turn the evening's notes into your first adventure:</p>
				<ul>
					<li><strong>Organize your notes</strong> &mdash; record each NPC you established (with an occupation, ties, and maybe a trait) in the steading's Residents and Notable Neighbors.</li>
					<li><strong>Build a timeline</strong> of the events the players established, oldest to newest, and reconcile any contradictions.</li>
					<li><strong>Identify threats</strong> &mdash; the sources of trouble lurking in those notes.</li>
					<li>Keep an <strong>&ldquo;I wonder&hellip;&rdquo;</strong> list of open questions to answer in play.</li>
					<li><strong>Plan the first adventure</strong> from your threats, that &ldquo;I wonder&hellip;&rdquo; list, and the Seasons Change result.</li>
				</ul>`,
	},
];

export class SpringBurstDialog extends StepperDialog {
	constructor(options = {}) {
		super(options);
		// Set once the GM hands the roll to the table via chat. The result lands in
		// chat, not here, so the omen step can't gate the gains on a tier it never
		// sees — it shows all gains once the roll's been delegated. Persisted in the
		// resume record (see _saveResume/_restoreStep) so a reload that resumes on the
		// roll step doesn't hide the gains the GM already ticked.
		this._delegatedRoll = false;
	}

	get _steps() { return _STEPS; }
	get _answersSetting() { return ANSWERS_SETTING; }

	static open() {
		return openOrFocus("stonetop-spring-burst", () => {
			const dialog = new SpringBurstDialog();
			dialog._restoreStep();   // reopen on the step left off at before a reload
			return dialog.render(true);
		});
	}

	// ── Reload-resume ──────────────────────────────────────────────────────────
	// The dialog doesn't survive a browser refresh; record the current step + that
	// we're open so hooks/Ready.js can reopen it here. See walkthrough-resume.js.
	async _render(force, options) {
		await super._render(force, options);
		this._saveResume();
	}

	async close(options = {}) {
		// Closing on purpose clears the open flag (no auto-reopen next load); a reload
		// skips close() and leaves it set. The saved step stays for a manual reopen.
		patchWalkthroughResume(RESUME_KEY, { open: false });
		return super.close(options);
	}

	_restoreStep() {
		const saved = getWalkthroughResume(RESUME_KEY);
		const step  = Number(saved?.step);
		if (Number.isInteger(step) && step >= 0 && step < this._steps.length) this._step = step;
		// Restore the roll-delegated flag too (it gates the gains checklist) so resuming
		// on the roll step keeps showing the gains the GM had already ticked.
		this._delegatedRoll = !!saved?.delegated;
	}

	_saveResume() {
		const cur = getWalkthroughResume(RESUME_KEY);
		if (cur?.open === true && cur.step === this._step && cur.delegated === this._delegatedRoll) return;
		patchWalkthroughResume(RESUME_KEY, { open: true, step: this._step, delegated: this._delegatedRoll });
	}

	// "Done" on the final step compiles everything recorded — the Introductions
	// answers and the notes from this walkthrough — into the Chronicle, then closes.
	// This is the session-zero flow's last save, so the Spring Burst page lands in the
	// journal here. Keep the dialog open if the save errors so the GM can retry.
	async _finish(button) {
		if (!(await saveChronicleFromButton(button, { context: "Let Spring Burst Forth" }))) return;
		// The first spring is itself a Seasons Change move, so record it in the per-year
		// "Seasons Change" journal (Year 1 → Spring) — the same log the steading flow keeps
		// from Summer on, so the seasons history starts at this opening spring rather than a
		// season later. Carries the gains the table ticked, this first spring's +Fortunes
		// (+1), and the omen/hook the GM noted as the season's note.
		const picked    = this._answers().gains ?? {};
		const gainNames = SEASONAL_GAINS.filter(g => picked[g.key]).map(g => g.name);
		await recordSeasonsChange({
			seasonId: "spring",
			year:     1,
			gainNames,
			fortunes: FIRST_SPRING_FORTUNES,
			notes:    this._answers().hook ?? "",
		});
		// Spring has burst forth: mark this walkthrough finished. With the Introductions
		// also done, hooks/Ready.js stops auto-opening the Welcome guide (sessionZeroComplete).
		// Drop the saved step + delegated flag so a manual reopen starts a fresh run.
		markWalkthroughDone(RESUME_KEY, ["step", "delegated"]);
		return this.close();
	}

	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id:        "stonetop-spring-burst",
			title:     "Let Spring Burst Forth",
			template:  "systems/stonetop/templates/dialogs/spring-burst.hbs",
			width:     520,
			height:    "auto",
			resizable: true,
			classes:   ["stonetop", "stonetop-spring-dialog"],
		});
	}

	activateListeners(html) {
		super.activateListeners(html);
		this._bindStepNav(html);
		html.find(".stonetop-spring-ask-btn").on("click", () => this._askToRoll());
		html.find(".stonetop-spring-done").on("click", ev => this._finish(ev.currentTarget));
		// Save answers on blur/change so the textarea keeps focus while typing.
		html.find(".stonetop-spring-qa-answer").on("change", ev => {
			const el = ev.currentTarget;
			this._saveAnswer(el.dataset.answerKey, el.value, el.dataset.answerId);
		});
		// Mark which seasonal gain(s) were picked. No re-render — the checkbox toggles
		// natively and we just persist, so nothing on the step is lost.
		html.find(".stonetop-season-gain-check").on("change", ev => {
			this._saveGain(ev.currentTarget.dataset.gainKey, ev.currentTarget.checked);
		});
	}

	getData() {
		const nav  = this._stepNav();
		const step = nav.step;
		return {
			...nav,
			showRoll:  !!step.showRoll,
			showTiers: !!step.showTiers,
			tiers:     step.showTiers
				? _OMEN_TIERS.map(t => ({ text: t.text, label: SPRING_SEASONS_RESULT[t.key].label }))
				: null,
			// Offer the gains once the roll's been handed to the table. The roll lands in
			// chat, not here, so the dialog never learns the tier — it shows the gains the
			// moment the GM delegates the roll (and not before).
			gains:     step.showGains && this._delegatedRoll ? this._gainsContext() : null,
			qa:        this._qaContext(step.qa),
		};
	}

	// The seasonal-gains checklist for the omen step: each Book I gain plus whether
	// it's been ticked (stored in springBurstAnswers.gains by key).
	_gainsContext() {
		const picked = this._answers().gains ?? {};
		return SEASONAL_GAINS.map(g => ({ ...g, checked: !!picked[g.key] }));
	}

	// Persist a ticked/unticked seasonal gain. Stored as a presence map under `gains`
	// so an unchecked one is dropped rather than left as `false`.
	async _saveGain(key, checked) {
		if (!key) return;
		const all   = { ...this._answers() };
		const gains = { ...(all.gains ?? {}) };
		if (checked) gains[key] = true; else delete gains[key];
		all.gains = gains;
		await setSetting(ANSWERS_SETTING, all);
	}

	// Build the current step's Q&A field(s) for the template. `single` is one
	// prompt + stored answer; `perPc` is one row per player character (answers
	// stored by actor id), mirroring the journal Q&A lists.
	_qaContext(qa) {
		if (!qa) return null;
		const all = this._answers();
		if (qa.kind === "perPc") {
			const stored = all[qa.key] ?? {};
			const rows = getPlayerCharacters().map(pc => ({
				id:     pc.id,
				prompt: qa.prompt(escHtml(pc.name)),
				answer: stored[pc.id] ?? "",
			}));
			return { kind: "perPc", key: qa.key, placeholder: qa.placeholder, rows, empty: rows.length ? "" : qa.empty };
		}
		return { kind: "single", key: qa.key, prompt: qa.prompt, placeholder: qa.placeholder, answer: all[qa.key] ?? "" };
	}

	// Persist one answer without re-rendering (so the textarea keeps focus). `id`
	// is set for per-PC answers (nested under the question key by actor id).
	async _saveAnswer(key, value, id) {
		if (!key) return;
		const all = { ...this._answers() };
		if (id) {
			all[key] = { ...(all[key] ?? {}), [id]: value };
		} else {
			all[key] = value;
		}
		await setSetting(ANSWERS_SETTING, all);
	}

	// Hand the roll to the table: post a chat card asking the most hopeful character's
	// player to roll +Fortunes, with a button they click to do it (the result lands in
	// chat). The dialog never sees the tier, so flag the roll as delegated and show the
	// gains checklist.
	_askToRoll() {
		postSeasonsRollPrompt({ alias: "Seasons Change — Spring", fortunes: FIRST_SPRING_FORTUNES });
		postSeasonsChangeReminder("spring");
		this._delegatedRoll = true;
		this.render(false);
	}
}
