export class StonetopActorSheet extends foundry.appv1.sheets.ActorSheet {
	async getData() {
		return super.getData();
	}

	activateListeners(html) {
		super.activateListeners(html);
		if (!this.isEditable) return;
		html[0].addEventListener("click", async ev => {
			const rollable = ev.target.closest(".rollable[data-roll]");
			if (!rollable) return;
			ev.stopPropagation();
			const handled = await this.actor._onRoll(ev);
			if (!handled) await this.actor.typedActor?.rollStat?.(rollable.dataset.roll);
		}, true);
	}
}
