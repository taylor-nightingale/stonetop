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
			if (!handled) {
				const stat = rollable.dataset.roll;
				await this._onRollStat(stat, stat.toUpperCase(), {});
			}
		}, true);
	}

	async _onRollStat(stat, label, options = {}) {
		const statValue = this.actor.system?.stats?.[stat]?.value ?? 0;
		const rollMode = options.rollMode;
		const formula =
			rollMode === "adv" ? `{2d6,2d6}kh + ${statValue}` :
			rollMode === "dis" ? `{2d6,2d6}kl + ${statValue}` :
			                     `2d6 + ${statValue}`;
		const roll = await new Roll(formula).evaluate();
		const total = roll.total;
		const resultLabel = game.i18n.localize(
			total >= 10 ? "stonetop.rollResults.strongHit" :
			total >= 7  ? "stonetop.rollResults.weakHit"  :
			              "stonetop.rollResults.miss"
		);
		await roll.toMessage({
			speaker: ChatMessage.getSpeaker({ actor: this.actor }),
			flavor: `${label} — ${resultLabel}`,
		});
	}
}
