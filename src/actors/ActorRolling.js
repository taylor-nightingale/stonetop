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
		if (request.stat === "ask") {
			statKey = await ActorRolling._pickStat(request.label, this._actor.typedActor.getRollableStats());
			if (!statKey) return;
		}

		let bonus = 0;
		if (request.stat !== "prompt") {
			bonus = this._actor.typedActor.resolveBonus(statKey);
			if (bonus === null) {
				return ChatMessage.create({speaker, content: `<h3>${request.label}</h3>${request.description}`});
			}
		}

		const effectiveMode = this._actor.typedActor.applyRollMode(statKey, request.rollMode);
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

	static async _pickStat(title, stats) {
		return new Promise(resolve => {
			const options = stats.map(s =>
				`<option value="${s.key}">${s.name} (${s.value})</option>`).join("");
			new Dialog({
				title,
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
}
