import { buildFocusSelector } from "./buildFocusSelector.js";
import { activateEditToggles } from "../utils/editToggle.js";
import { enrichRichTokens } from "../utils/enrichGameText.js";
import { activateSteppers } from "../utils/stepper.js";
import { activateComboBoxes } from "../utils/comboBox.js";

export class StonetopActorSheet extends foundry.appv1.sheets.ActorSheet {
	async getData() {
		return super.getData();
	}

	// Scroll containers whose position should survive a re-render (so e.g. picking an Origin
	// near the bottom doesn't jump the sheet back to the top).
	static SCROLL_SELECTORS = [".sheet-body", ".stonetop-moves-sidebar"];

	async _render(force, options) {
		const root     = this.element?.[0];
		const selector = buildFocusSelector(document.activeElement, root);
		const scroll   = {};
		for (const sel of StonetopActorSheet.SCROLL_SELECTORS) {
			const el = root?.querySelector(sel);
			if (el) scroll[sel] = el.scrollTop;
		}

		await super._render(force, options);

		const el = this.element?.[0];
		// Markdown is already rendered by the {{md}} helper; upgrade explicit rolls/@UUID links.
		await enrichRichTokens(el, { rollData: this.actor?.getRollData?.() ?? {} });
		if (selector) el?.querySelector(selector)?.focus();
		// Restore scroll last, after enrichment may have changed element heights.
		for (const [sel, top] of Object.entries(scroll)) {
			const target = el?.querySelector(sel);
			if (target) target.scrollTop = top;
		}
	}

	activateListeners(html) {
		super.activateListeners(html);
		activateEditToggles(html[0]);
		activateSteppers(html[0]);
		activateComboBoxes(html[0]);
		if (!this.isEditable) return;
		html[0].addEventListener("click", async ev => {
			const rollable = ev.target.closest(".rollable[data-roll]");
			if (!rollable) return;
			ev.stopPropagation();
			await this.actor._onRoll(ev);
		}, true);
	}
}
