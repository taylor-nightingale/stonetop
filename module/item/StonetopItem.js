import {StonetopPlaybook} from "./StonetopPlaybook.js";

export function createStonetopItemClass(BaseItem) {
	return class StonetopItem extends BaseItem {

		asPlaybook() {
			return new StonetopPlaybook(this);
		}

		async roll({ rollMode = "def", descriptionOnly = false } = {}) {
			const actor = this.actor;
			const statKey = this.system?.rollType;
			const speaker = ChatMessage.getSpeaker({ actor: actor ?? undefined });

			if (descriptionOnly || !statKey || !actor) {
				return ChatMessage.create({
					speaker,
					content: `<h3>${this.name}</h3>${this.system?.description ?? ""}`,
				});
			}

			const statValue = actor.system?.stats?.[statKey]?.value ?? 0;
			const formula =
				rollMode === "adv" ? `{2d6,2d6}kh + ${statValue}` :
				rollMode === "dis" ? `{2d6,2d6}kl + ${statValue}` :
				                     `2d6 + ${statValue}`;

			const roll = await new Roll(formula).evaluate();
			const total = roll.total;
			const resultKey =
				total >= 10 ? "success" :
				total >= 7  ? "partial" :
				              "failure";
			const resultLabel = game.i18n.localize(
				resultKey === "success" ? "stonetop.rollResults.strongHit" :
				resultKey === "partial"  ? "stonetop.rollResults.weakHit"  :
				                          "stonetop.rollResults.miss"
			);
			const resultText = this.system?.moveResults?.[resultKey]?.value ?? "";
			const content = resultText ? `<p>${resultText}</p>` : undefined;

			return roll.toMessage({
				speaker,
				flavor: `${this.name} (+${statKey.toUpperCase()}) — ${resultLabel}`,
				content,
			});
		}
	};
}
