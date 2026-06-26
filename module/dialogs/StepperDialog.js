import { FrontOnOpen } from "../utils/front-on-open.js";
import { getSetting } from "../settings.js";

// ── StepperDialog ────────────────────────────────────────────────────────────
// Shared scaffolding for the linear "walkthrough" dialogs (Spring Burst,
// Expedition, Create Follower): a `_step` cursor over a list of steps, the
// FrontOnOpen lifecycle, Back/Next navigation, and the per-render nav context.
//
// Subclasses provide the steps via `get _steps()`, spread `_stepNav()` into their
// `getData`, call `_bindStepNav(html)` from `activateListeners`, and may override
// `_onBeforeStepChange()` to flush focused-but-unblurred fields before navigating.
export class StepperDialog extends Application {
	constructor(options = {}) {
		super(options);
		this._step      = 0;
		this._frontOnOpen = new FrontOnOpen(this);
	}

	/** @returns {Array<object>} The ordered steps; the final one is flagged `isFinal`. */
	get _steps() { return []; }

	/** The world-setting key holding this dialog's persisted Q&A notes. Subclasses
	 *  that show note fields override this; others leave it null. */
	get _answersSetting() { return null; }

	/** The persisted answers blob, read fresh each render so navigating Back/Next
	 *  shows whatever the GM has already typed. */
	_answers() {
		return (this._answersSetting ? getSetting(this._answersSetting) : null) ?? {};
	}

	async _render(force, options) {
		await super._render(force, options);
		this._frontOnOpen.apply();
	}

	async close(options = {}) {
		this._frontOnOpen.stop();
		return super.close(options);
	}

	// Per-render navigation context: the active step plus its position labels. The
	// `steps` list lets a template render a jump-to-step table of contents (only the
	// Expedition dialog does today); it's harmless extra data for the others.
	_stepNav() {
		const steps = this._steps;
		const step  = steps[this._step];
		return {
			step,
			steps: steps.map((s, i) => ({
				index:    i,
				title:    s.title,
				icon:     s.icon,
				isActive: i === this._step,
			})),
			stepIndex: this._step + 1,
			stepCount: steps.length,
			stepLabel: `Step ${this._step + 1} of ${steps.length}`,
			isFirst:   this._step === 0,
			isLast:    !!step.isFinal,
		};
	}

	// Start the front-on-open watcher and wire the shared Back/Next buttons plus any
	// jump-to-step table-of-contents buttons.
	_bindStepNav(html) {
		this._frontOnOpen.start();
		html.find(".stonetop-spring-back").on("click", () => this._retreat());
		html.find(".stonetop-spring-next").on("click", () => this._advance());
		html.find(".stonetop-guide-toc-btn").on("click", ev => this._goTo(Number(ev.currentTarget.dataset.stepIndex)));
	}

	// Hook for subclasses to capture live field values before changing steps.
	_onBeforeStepChange() {}

	_advance() {
		this._onBeforeStepChange();
		if (this._step < this._steps.length - 1) { this._step++; this.render(false); }
	}

	_retreat() {
		this._onBeforeStepChange();
		if (this._step > 0) { this._step--; this.render(false); }
	}

	// Jump straight to a step (table-of-contents click). Flushes the current field
	// first, like Back/Next.
	_goTo(index) {
		if (!Number.isInteger(index) || index < 0 || index >= this._steps.length || index === this._step) return;
		this._onBeforeStepChange();
		this._step = index;
		this.render(false);
	}
}
