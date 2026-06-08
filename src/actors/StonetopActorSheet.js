import { buildFocusSelector } from "./buildFocusSelector.js";

export class StonetopActorSheet extends foundry.appv1.sheets.ActorSheet {
	async getData() {
		return super.getData();
	}

	async _render(force, options) {
		const selector = buildFocusSelector(document.activeElement, this.element[0]);
		await super._render(force, options);
		if (selector) this.element[0]?.querySelector(selector)?.focus();
	}

	activateListeners(html) {
		super.activateListeners(html);
		if (!this.isEditable) return;
		html[0].addEventListener("click", async ev => {
			const rollable = ev.target.closest(".rollable[data-roll]");
			if (!rollable) return;
			ev.stopPropagation();
			await this.actor._onRoll(ev);
		}, true);
	}
}
