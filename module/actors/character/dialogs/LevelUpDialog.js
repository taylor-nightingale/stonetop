import { FrontOnOpen } from "../../../utils/front-on-open.js";
import { markProseSpiralBullets } from "../../../utils/journal-spiral-bullets.js";

export class LevelUpDialog extends Application {
	constructor(character, levelUpData, onDone, options = {}) {
		super(options);
		this._character  = character;
		this._data       = levelUpData;
		this._step       = "overview"; // "overview" | "move" | "invocation"
		this._selectedMoveId         = null;
		this._selectedInvocationSlug = null;
		this._showLockedMoves        = false;
		this._onDone = onDone;
		this._frontOnOpen = new FrontOnOpen(this);
	}

	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id:        "stonetop-levelup-dialog",
			template:  "systems/stonetop/templates/dialogs/level-up.hbs",
			title:     game.i18n.localize("stonetop.specialMoves.levelUp.title"),
			width:     520,
			height:    520,
			resizable: true,
			classes:   ["stonetop", "stonetop-levelup-dialog"],
		});
	}

	async _render(force, options) {
		await super._render(force, options);
		this._frontOnOpen.apply();
	}

	async close(options = {}) {
		this._frontOnOpen.stop();
		return super.close(options);
	}

	getData() {
		const d = this._data;
		const isOverview   = this._step === "overview";
		const isMove       = this._step === "move";
		const isInvocation = this._step === "invocation";

		const isLastStep = isInvocation || (isMove && !d.needsInvocation);

		const moves = d.availableMoves.map(m => ({
			compendiumId:  m.compendiumId,
			name:          m.name,
			description:   m.description,
			requiresLabel: m.requiresLabel,
			selected:      m.compendiumId === this._selectedMoveId,
		}));

		const lockedMoves = d.lockedMoves.map(m => ({
			compendiumId:  m.compendiumId,
			name:          m.name,
			description:   m.description,
			requiresLabel: m.requiresLabel,
		}));

		const invocations = d.availableInvocations.map(inv => ({
			slug:        inv.slug,
			label:       inv.label,
			description: inv.description,
			selected:    inv.slug === this._selectedInvocationSlug,
		}));

		const canContinue = isOverview
			|| (isMove && this._selectedMoveId !== null)
			|| (isInvocation && this._selectedInvocationSlug !== null);

		return {
			isOverview,
			isMove,
			isInvocation,
			isLastStep,
			canContinue,
			level:           d.level,
			newLevel:        d.newLevel,
			xp:              d.xp,
			cost:            d.cost,
			xpRemaining:     d.xpRemaining,
			moves,
			hasMoves:        moves.length > 0,
			lockedMoves,
			hasLockedMoves:  lockedMoves.length > 0,
			showLockedMoves: this._showLockedMoves,
			invocations,
			needsInvocation: d.needsInvocation,
		};
	}

	activateListeners(html) {
		super.activateListeners(html);
		this._frontOnOpen.start();

		// Move / invocation descriptions are enriched move HTML that can contain
		// bulleted option lists; give them the same spiral bullets as the sheet.
		for (const desc of html.find(".stonetop-levelup-move-description, .stonetop-levelup-invocation-description")) {
			markProseSpiralBullets(desc);
		}

		html.find(".stonetop-levelup-move-option:not(.is-locked)").on("click", ev => {
			this._selectedMoveId = ev.currentTarget.dataset.compendiumId;
			this.render(false);
		});

		html.find(".stonetop-levelup-locked-check").on("change", ev => {
			this._showLockedMoves = ev.currentTarget.checked;
			this.render(false);
		});

		html.find(".stonetop-levelup-invocation-option").on("click", ev => {
			this._selectedInvocationSlug = ev.currentTarget.dataset.slug;
			this.render(false);
		});

		html.find(".stonetop-levelup-back-btn").on("click", () => {
			if (this._step === "invocation") this._step = "move";
			else if (this._step === "move")  this._step = "overview";
			this.render(false);
		});

		html.find(".stonetop-levelup-next-btn").on("click", async () => {
			const d = this._data;
			if (this._step === "overview") {
				this._step = "move";
			} else if (this._step === "move") {
				if (d.needsInvocation) this._step = "invocation";
				else await this._apply();
			} else if (this._step === "invocation") {
				await this._apply();
			}
			this.render(false);
		});
	}

	async _apply() {
		await this._character.applyLevelUp(this._selectedMoveId, this._selectedInvocationSlug);
		if (this._onDone) this._onDone();
		this.close();
	}
}
