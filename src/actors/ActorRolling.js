import {RollDisplay} from "../utils/rollDisplay.js";

export class ActorRolling {
	constructor(actor) {
		this._actor = actor;
	}

	get _display() {
		return this.__display ??= new RollDisplay(k => game.i18n.localize(k));
	}

	async execute(request, {descriptionOnly = false} = {}) {
		const speaker = ChatMessage.getSpeaker({actor: this._actor});

		if (descriptionOnly || !request.stat) {
			return ChatMessage.create({speaker, content: `<h3>${request.label}</h3>${request.description}`});
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
				return ChatMessage.create({speaker, content: `<h3>${request.label}</h3>${request.description}`});
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

		return ChatMessage.create({
			speaker,
			content: this._display.build(roll, {
				name:        request.buildDisplayName(statKey, resultLabel, request.stat === "prompt"),
				rollMode:    effectiveMode,
				bonus:       request.stat !== "prompt" ? bonus : null,
				statKey:     request.stat !== "prompt" ? statKey : null,
				resultKey,
				description: request.description,
				resultText:  request.resultText(resultKey),
			}),
			rolls: [roll],
		});
	}

	async _rollDamage(speaker) {
		const die = this._actor.system?.attributes?.damage?.value;
		if (!die) return;
		const formula = /^\d/.test(die) ? die : `1${die}`;
		const roll = await new Roll(formula).evaluate();
		return ChatMessage.create({
			speaker,
			content: this._display.build(roll, {
				name: game.i18n.localize("stonetop.character.attributes.damage"),
			}),
			rolls: [roll],
		});
	}

	_rollingFormula(rollMode, bonus) {
		switch (rollMode) {
			case "adv": return `3d6kh2 + ${bonus}`;
			case "dis": return `3d6kl2 + ${bonus}`;
			default:    return `2d6 + ${bonus}`;
		}
	}

	static async _pickStat(title, stats, initialRollMode = "def") {
		return new Promise(resolve => {
			const modes = [
				{key: "adv", labelKey: "stonetop.rollMode.adv"},
				{key: "def", labelKey: "stonetop.rollMode.normal"},
				{key: "dis", labelKey: "stonetop.rollMode.dis"},
			];
			const modeHtml = modes.map(m =>
				`<li><label class="stonetop-outfit-load-label${m.key === initialRollMode ? " is-checked" : ""}">` +
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
