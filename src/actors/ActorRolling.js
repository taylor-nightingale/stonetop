import {RollDisplay} from "../utils/rollDisplay.js";
import {RollOutcome} from "./RollOutcome.js";
import {RollModes} from "./RollModes.js";
import {renderRollCard, postDescriptionCard} from "../utils/rollCard.js";
import {rich} from "../model/snapshot/RichText.js";
import {buildXpLine} from "../chat/xpMarkControl.js";

const PICK_STAT_TEMPLATE = "systems/stonetop/templates/apps/roll-pick.hbs";

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

		const effectiveMode = this._actor.typedActor.applyRollMode(statKey, rollMode, request.moveSlug);
		const formula = this._rollingFormula(effectiveMode, bonus);
		const roll = await new Roll(formula).evaluate();
		const outcome = RollOutcome.fromTotal(roll.total, k => game.i18n.localize(k));

		// The book's XP rule — mark XP on a 6-, unless the move says otherwise (request.xpOnMiss) —
		// is offered, not automated: players roll moves for fun or by accident, so the card carries
		// a Mark XP button instead of ticking the track on its own. Only actors with an XP track
		// (characters) get the offer.
		const xpOffer = outcome.isMiss && request.xpOnMiss
			&& typeof this._actor.typedActor.markXp === "function";

		// The card carries name, outcome and dice as three separate facts, so the template can put
		// the outcome where it reads — a badge on the dice line — instead of in the headline.
		const card = {
			name: request.titleFor(statKey),
			icon: request.icon,
			dice: this._display.build(roll, {
				rollMode: effectiveMode,
				bonus:    request.stat !== "prompt" ? bonus : null,
				statKey:  request.stat !== "prompt" ? statKey : null,
			}),
			outcome,
			description: rich(request.description),
			resultText:  rich(request.resultText(outcome.key)),
			xpLine: xpOffer ? buildXpLine(false, k => game.i18n.localize(k)) : null,
		};
		return ChatMessage.create({
			speaker,
			content: await renderRollCard(card, this._rollData),
			rolls: [roll],
			...(xpOffer ? {flags: {stonetop: {xpMark: {marked: false}}}} : {}),
		});
	}

	// Bare text → description card, for content that has no move item behind it (e.g. an arcanum's
	// inline mystery moves).
	async postDescription(label, description) {
		const speaker = ChatMessage.getSpeaker({actor: this._actor});
		return postDescriptionCard(speaker, {name: label, description}, this._rollData);
	}

	async _postDescription(speaker, request) {
		return postDescriptionCard(speaker,
			{name: request.label, icon: request.icon, description: request.description, moveResults: request.moveResults},
			this._rollData);
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
		// The radios come from the same partial the sheet's side-bar renders — the two used to be
		// hand-copied markup and had already drifted apart.
		const content = await foundry.applications.handlebars.renderTemplate(PICK_STAT_TEMPLATE, {
			modes: RollModes.options(initialRollMode),
		});

		return new Promise(resolve => {
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
