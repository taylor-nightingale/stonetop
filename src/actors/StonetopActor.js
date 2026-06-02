import {StonetopCharacter} from "./character/StonetopCharacter.js";
import {StonetopSteading} from "./steading/StonetopSteading.js";
import {buildRollContent} from "../utils/rollDisplay.js";

export function createStonetopActorClass(BaseActor) {
	return class StonetopActor extends BaseActor {
		_typedActor;

		constructor(...args) {
			super(...args);
		}

		get typedActor() {
			if (this._typedActor) return this._typedActor;

			switch (this.type) {
				case "character":
					this._typedActor = StonetopCharacter.create(this);
					break;
				case "steading":
					this._typedActor = new StonetopSteading(this);
					break;
			}

			return this._typedActor;
		}

		// -- Lifecycle ---------------------------------------------

		async _onRoll(event) {
			const itemId = event.target.closest(".item")?.dataset.itemId;
			if (!itemId) return false;
			const item = this.items.get(itemId);
			if (!item) return false;

			const isDescription = event.target.getAttribute("data-show") === "description";
			const rollStat      = event.target.closest("[data-roll]")?.dataset.roll || null;
			const hideRollMode  = game.settings.get("stonetop", "hideRollMode");
			const rollMode      = hideRollMode ? "def" : this.typedActor.rollMode;

			await this._executeRoll(item, { rollMode, rollStat, descriptionOnly: isDescription });
			return true;
		}

		async _executeRoll(item, { rollMode = "def", descriptionOnly = false, rollStat } = {}) {
			rollStat ??= item.system?.rollStat;
			const speaker  = ChatMessage.getSpeaker({ actor: this });

			if (descriptionOnly || !rollStat) {
				return ChatMessage.create({ speaker, content: `<h3>${item.name}</h3>${item.system?.description ?? ""}` });
			}

			if (rollStat === "damage") return this._rollDamage(speaker);

			let statKey = rollStat;
			if (rollStat === "ask") {
				const stats = this.typedActor.getRollableStats();
				statKey = await StonetopActor._pickStat(item.name, stats);
				if (!statKey) return;
			}

			let bonus = 0;
			if (rollStat !== "prompt") {
				bonus = this.typedActor.resolveBonus(statKey);
				if (bonus === null) {
					return ChatMessage.create({ speaker, content: `<h3>${item.name}</h3>${item.system?.description ?? ""}` });
				}
			}

			const effectiveMode = this.typedActor.applyRollMode(statKey, rollMode);
			const formula =
				effectiveMode === "adv" ? `{2d6,2d6}kh + ${bonus}` :
				effectiveMode === "dis" ? `{2d6,2d6}kl + ${bonus}` :
				                          `2d6 + ${bonus}`;

			const roll = await new Roll(formula).evaluate();
			const total = roll.total;
			const resultKey =
				total >= 10 ? "success" : total >= 7 ? "partial" : "failure";
			const resultLabel = game.i18n.localize(
				resultKey === "success" ? "stonetop.rollResults.strongHit" :
				resultKey === "partial"  ? "stonetop.rollResults.weakHit"  :
				                          "stonetop.rollResults.miss"
			);

			const statLabel   = rollStat === "prompt" ? "" : ` (+${statKey.toUpperCase()})`;
			const description = item.system?.description ?? "";
			const resultText  = item.system?.moveResults?.[resultKey]?.value ?? "";

			return ChatMessage.create({
				speaker,
				content: buildRollContent(roll, {
					name:        `${item.name}${statLabel} — ${resultLabel}`,
					rollMode:    effectiveMode,
					bonus:       rollStat !== "prompt" ? bonus : null,
					statKey:     rollStat !== "prompt" ? statKey : null,
					resultKey,
					description,
					resultText,
				}),
				rolls: [roll],
			});
		}

		async _rollDamage(speaker) {
			const die = this.system?.attributes?.damage?.value;
			if (!die) return;
			const roll = await new Roll(`1${die}`).evaluate();
			return roll.toMessage({ speaker, flavor: game.i18n.localize("stonetop.character.attributes.damage") });
		}

		static async _pickStat(moveName, stats) {
			return new Promise(resolve => {
				const options = stats.map(s => `<option value="${s.key}">${s.name} (${s.value})</option>`).join("");
				new Dialog({
					title: moveName,
					content: `<select name="stat">${options}</select>`,
					buttons: {
						roll: {
							label: game.i18n.localize("stonetop.dialog.roll"),
							callback: html => resolve(html.find("[name=stat]").val()),
						},
					},
					default: "roll",
					close: () => resolve(null),
				}).render(true);
			});
		}

		async _onCreateDescendantDocuments(parent, collection, documents, data, options, userId) {
			await super._onCreateDescendantDocuments(parent, collection, documents, data, options, userId);
			if (this.typedActor.type === "character" && collection === "items") {
				await this.typedActor._onCreateDescendantDocuments(documents);
			}
		}
	};
}
