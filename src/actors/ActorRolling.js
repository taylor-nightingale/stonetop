import {RollDisplay} from "../utils/rollDisplay.js";
import {renderRollCard} from "../utils/rollCard.js";
import {rich} from "../model/snapshot/RichText.js";
import {buildXpLine} from "../chat/xpMarkControl.js";

export class ActorRolling {
	constructor(actor) {
		this._actor = actor;
	}

	get _display() {
		return this.__display ??= new RollDisplay(k => game.i18n.localize(k));
	}

	get _rollData() {
		return this._actor.getRollData?.() ?? {};
	}

	async execute(request, {descriptionOnly = false} = {}) {
		const speaker = ChatMessage.getSpeaker({actor: this._actor});

		if (descriptionOnly || !request.stat) {
			return this._postDescription(speaker, request);
		}

		if (request.stat === "damage") return this._rollDamage(speaker);

		let statKey = request.stat;
		let rollMode = request.rollMode;
		if (request.stat === "ask") {
			const picked = await ActorRolling._pickStat(request.label, this._actor.typedActor.getRollableStats(), request.rollMode);
			if (!picked) return;
			statKey = picked.stat;
			rollMode = picked.rollMode;
		}

		let bonus = 0;
		if (request.stat !== "prompt") {
			bonus = this._actor.typedActor.resolveBonus(statKey);
			if (bonus === null) {
				return this._postDescription(speaker, request);
			}
		}

		const effectiveMode = this._actor.typedActor.applyRollMode(statKey, rollMode);
		const formula = this._rollingFormula(effectiveMode, bonus);
		const roll = await new Roll(formula).evaluate();
		const total = roll.total;
		const resultKey = total >= 10 ? "success" : total >= 7 ? "partial" : "failure";
		const resultLabel = game.i18n.localize(
			resultKey === "success" ? "stonetop.rollResults.strongHit" :
				resultKey === "partial" ? "stonetop.rollResults.weakHit" :
					"stonetop.rollResults.miss"
		);

		// The book's XP rule: mark XP on a 6- roll, unless the move says otherwise (request.xpOnMiss)
		// or the actor has no XP track (NPCs, steadings).
		const xpMarked = resultKey === "failure" && request.xpOnMiss
			&& (await this._actor.typedActor.markXp?.()) === true;

		const card = {
			name: request.buildDisplayName(statKey, resultLabel, request.stat === "prompt"),
			dice: this._display.build(roll, {
				rollMode: effectiveMode,
				bonus:    request.stat !== "prompt" ? bonus : null,
				statKey:  request.stat !== "prompt" ? statKey : null,
			}),
			resultKey,
			description: rich(request.description),
			resultText:  rich(request.resultText(resultKey)),
			xpLine: xpMarked ? buildXpLine(false, k => game.i18n.localize(k)) : null,
		};
		return ChatMessage.create({
			speaker,
			content: await renderRollCard(card, this._rollData),
			rolls: [roll],
			...(xpMarked ? {flags: {stonetop: {xpMark: {undone: false}}}} : {}),
		});
	}

	async _postDescription(speaker, request) {
		const card = {name: request.label, description: rich(request.description)};
		return ChatMessage.create({speaker, content: await renderRollCard(card, this._rollData)});
	}

	async _rollDamage(speaker) {
		const die = this._actor.system?.attributes?.damage?.value;
		if (!die) return;
		const formula = /^\d/.test(die) ? die : `1${die}`;
		const roll = await new Roll(formula).evaluate();
		const card = {
			name: game.i18n.localize("stonetop.character.attributes.damage"),
			dice: this._display.build(roll, {}),
		};
		return ChatMessage.create({speaker, content: await renderRollCard(card, this._rollData), rolls: [roll]});
	}

	_rollingFormula(rollMode, bonus) {
		switch (rollMode) {
			case "adv": return `3d6kh2 + ${bonus}`;
			case "dis": return `3d6kl2 + ${bonus}`;
			default:    return `2d6 + ${bonus}`;
		}
	}

	static async _pickStat(title, stats, initialRollMode = "normal") {
		return new Promise(resolve => {
			const modes = [
				{key: "adv", labelKey: "stonetop.rollMode.adv"},
				{key: "normal", labelKey: "stonetop.rollMode.normal"},
				{key: "dis", labelKey: "stonetop.rollMode.dis"},
			];
			const modeHtml = modes.map(m =>
				`<li><label class="stonetop-outfit-load-label">` +
				`<input type="radio" class="stonetop-roll-mode-radio" name="rollMode" value="${m.key}"${m.key === initialRollMode ? " checked" : ""}>` +
				`${game.i18n.localize(m.labelKey)}</label></li>`
			).join("");
			const content =
				`<div class="stonetop-roll-pick-content">` +
				`<div class="stonetop-roll-mode-header">` +
				`<p class="stonetop-outfit-heading">${game.i18n.localize("stonetop.rollMode.label")}</p>` +
				`<ul class="stonetop-outfit-loads">${modeHtml}</ul>` +
				`</div></div>`;

			const buttons = {};
			for (const s of stats) {
				const sign = s.value >= 0 ? "+" : "";
				buttons[s.key] = {
					label: `<i class="fas fa-dice-d6"></i> ${s.name}<span class="stonetop-roll-pick-mod">${sign}${s.value}</span>`,
					callback: html => resolve({
						stat: s.key,
						rollMode: html.find("[name=rollMode]:checked").val() ?? initialRollMode,
					}),
				};
			}

			new Dialog(
				{title, content, buttons, default: stats[0]?.key, close: () => resolve(null)},
				{classes: ["stonetop-roll-dialog"], width: 440},
			).render(true);
		});
	}
}
