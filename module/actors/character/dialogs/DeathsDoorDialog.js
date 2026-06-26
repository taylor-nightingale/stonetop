import { FrontOnOpen } from "../../../utils/front-on-open.js";
import { stonetopChatCard, rollFormulaChip, rollResultNumber } from "../../../utils/chat.js";
import { classifyResult, multiDieFaces } from "../../../utils/roll-engine.js";

// Death's Door result labels, keyed by the shared 2d6 tier (classifyResult().key).
const _DEATHS_DOOR_LABELS = {
	success: "10+ &mdash; You wrest yourself back to the realm of the living.",
	partial: "7-9 &mdash; No longer dying, but out of the action.",
	failure: "6- &mdash; Your time has come.",
};

export class DeathsDoorDialog extends Application {
	constructor(character, onDone, options = {}) {
		super(options);
		this._character = character;
		this._step = "overview"; // "overview" | "mechanics" | "results"
		this._onDone = onDone;
		this._frontOnOpen = new FrontOnOpen(this);
	}

	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id:        "stonetop-deathsdoor-dialog",
			template:  "systems/stonetop/templates/dialogs/deaths-door.hbs",
			title:     "Death's Door",
			width:     600,
			height:    "auto",
			resizable: true,
			classes:   ["stonetop", "stonetop-deathsdoor-dialog"],
		});
	}

	async _render(force, options) {
		await super._render(force, options);
		this._frontOnOpen.apply();
		// Re-measure so the window always shrinks to fit the current step's content.
		this.setPosition({ height: "auto" });
	}

	async close(options = {}) {
		this._frontOnOpen.stop();
		return super.close(options);
	}

	getData() {
		const isOverview = this._step === "overview";
		const isMechanics = this._step === "mechanics";
		const isResults = this._step === "results";

		const total = this._rolledTotal ?? null;
		const key = total === null ? null : classifyResult(total).key;

		return {
			isOverview,
			isMechanics,
			isResults,
			rolledTotal: total,
			isStrong:    key === "success",
			isWeak:      key === "partial",
			isMiss:      key === "failure",
		};
	}

	activateListeners(html) {
		super.activateListeners(html);
		this._frontOnOpen.start();

		html.find(".deaths-door-next-btn").on("click", () => this._onNext());
		html.find(".deaths-door-back-btn").on("click", () => this._onBack());
		html.find(".deaths-door-roll-btn").on("click", () => this._onRoll());
		html.find(".deaths-door-confirm-btn").on("click", () => this._onConfirm());
		html.find(".deaths-door-cancel-btn").on("click", () => this.close());
	}

	async _onRoll() {
		const actor = this._character?._actor ?? null;
		const roll  = await new Roll("2d6").evaluate();
		const total = roll.total;
		const { key } = classifyResult(total);

		const dieFaces = multiDieFaces(roll);
		const flavor = stonetopChatCard("Death's Door", `<div class="card-content">
				${rollFormulaChip(roll.formula, dieFaces)}
				<div class="stonetop-roll-result ${key}">
					${rollResultNumber(total, dieFaces)}
					<div class="stonetop-roll-result-body">
						<span class="stonetop-roll-result-label">${_DEATHS_DOOR_LABELS[key]}</span>
						<span class="stonetop-roll-result-details"></span>
					</div>
				</div>
			</div>`);

		await roll.toMessage({
			speaker:  actor ? ChatMessage.getSpeaker({ actor }) : ChatMessage.getSpeaker(),
			flavor,
			rollMode: game.settings.get("core", "rollMode"),
		});

		// Act like Continue was pressed: advance to the screen describing this result.
		// The tier is re-derived from this total in getData(), so only the total is stored.
		this._rolledTotal = total;
		this._step        = key === "failure" ? "results" : "mechanics";
		this.render(true);
	}

	_onNext() {
		const steps = ["overview", "mechanics", "results"];
		const currentIndex = steps.indexOf(this._step);
		if (currentIndex < steps.length - 1) {
			this._step = steps[currentIndex + 1];
			this.render(true);
		}
	}

	_onBack() {
		const steps = ["overview", "mechanics", "results"];
		const currentIndex = steps.indexOf(this._step);
		if (currentIndex > 0) {
			this._step = steps[currentIndex - 1];
			this.render(true);
		}
	}

	async _onConfirm() {
		// Add a note to the character that they understand Death's Door
		ui.notifications?.info?.("You now understand Death's Door. When you are dying, you can roll +nothing to face it.");
		this.close();
		this._onDone?.();
	}
}
