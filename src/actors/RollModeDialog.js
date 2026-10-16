import { RollModes } from "./RollModes.js";
import { RollChoice } from "./RollPrompt.js";
import { inWindowOf } from "../utils/inWindowOf.js";

const TEMPLATE = "systems/stonetop/templates/apps/roll-prompt.hbs";

/**
 * Asks Advantage, Normal or Disadvantage before every 2d6 roll — and which stat, for a move that
 * rolls "ask". Answers a RollChoice, or null when the dialog is dismissed.
 */
export class RollModeDialog {
	constructor({
		wait   = config => foundry.applications.api.DialogV2.wait(config),
		render = (path, context) => foundry.applications.handlebars.renderTemplate(path, context),
	} = {}) {
		this._wait   = wait;
		this._render = render;
	}

	async pick(prompt, { openRule = async () => {}, app } = {}) {
		return this._wait({
			window:  { title: prompt.title, icon: "fa-solid fa-dice" },
			classes: ["stonetop", "sheet", "stonetop-roll-dialog"],
			content: (await this._render(TEMPLATE, prompt)).trim(),
			buttons: RollModes.options().map(option => RollModeDialog._button(option, prompt)),
			actions: { openRule: () => openRule(prompt.rule.slug) },
			renderOptions: inWindowOf(app),
			render:  (_event, dialog) => {
				if (prompt.choosesStat) RollModeDialog._awaitStat(dialog.element);
			},
		});
	}

	static _button(option, prompt) {
		const isNormal = option.key === "normal";
		return {
			action:  option.key,
			label:   option.labelKey,
			class:   "stonetop-roll-mode-btn",
			default: isNormal,
			// Enter submits through the form's first submit button; with Normal the only one, Enter
			// can never roll Advantage just because it comes first.
			type:    isNormal ? "submit" : "button",
			callback: (_event, button) => new RollChoice(
				prompt.choosesStat ? button.form.elements.stat?.value || null : null,
				option.key,
			),
		};
	}

	static _awaitStat(root) {
		const form    = root.querySelector("form");
		const select  = form.querySelector("select[name=stat]");
		const formula = form.querySelector(".stonetop-roll-prompt-formula");
		const stat    = form.querySelector(".stonetop-roll-prompt-stat");
		const modes   = [...form.querySelectorAll(".form-footer button")];
		const bare    = formula.textContent;
		const sync = () => {
			const picked = select.selectedOptions[0];
			const none   = !select.value;
			formula.textContent = none ? bare : picked.dataset.formula;
			stat.textContent    = none ? "" : picked.dataset.abbr;
			for (const button of modes) button.disabled = none;
		};
		sync();
		select.addEventListener("change", sync);
		select.focus();
	}
}
