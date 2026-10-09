import {RollDisplay} from "../utils/rollDisplay.js";
import {RollOutcome} from "./RollOutcome.js";
import {RollModeDialog} from "./RollModeDialog.js";
import {RollChoice, RollPrompt} from "./RollPrompt.js";
import {RollableStat} from "./RollableStat.js";
import {renderRollCard, postDescriptionCard} from "../utils/rollCard.js";
import {rich} from "../model/snapshot/RichText.js";
import {buildXpLine} from "../chat/xpMarkControl.js";

export class ActorRolling {
	constructor(actor, dialog = new RollModeDialog()) {
		this._actor  = actor;
		this._dialog = dialog;
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

		const typed    = this._actor.typedActor;
		const choosing = request.stat === "ask";
		if (!choosing && request.stat !== "prompt" && typed.resolveBonus(request.stat) === null) {
			return this._postDescription(speaker, request);
		}

		// A request that carries a mode was shift-clicked: it rolls without asking. Nothing can pick
		// the stat for an "ask" move, so that one always asks.
		const choice = choosing || !request.rollMode
			? await this._dialog.pick(await this._prompt(request), {
				openRule: slug => typed.openMoveSheet(slug),
				app:      this._actor.sheet,
			})
			: new RollChoice(null, request.rollMode);
		if (!choice) return;

		const statKey = choice.stat ?? request.stat;
		const bonus   = statKey === "prompt" ? 0 : typed.resolveBonus(statKey);
		const effectiveMode = typed.applyRollMode(statKey, choice.rollMode, request.moveSlug);
		const formula = this._rollingFormula(effectiveMode, bonus);
		const roll = await new Roll(formula).evaluate();
		const outcome = RollOutcome.fromTotal(roll.total, k => game.i18n.localize(k));

		// The book's XP rule — mark XP on a 6-, unless the move says otherwise (request.xpOnMiss) —
		// is offered, not automated: players roll moves for fun or by accident, so the card carries
		// a Mark XP button instead of ticking the track on its own. Only actors with an XP track
		// (characters) get the offer.
		const xpOffer = outcome.isMiss && request.xpOnMiss
			&& typeof this._actor.typedActor.markXp === "function";

		// The tier is offered to the actor that made the roll, because a sheet can have something
		// waiting on it: the steading keeps its own Seasons Change result so the box lights the row
		// the dice landed on. Offered from here rather than from each roll site — the die on a move
		// row, the die in the season box and the turn's own rollItem are three paths to one roll.
		await this._actor.typedActor.recordMoveOutcome(request.moveSlug, outcome);

		// The card carries name, outcome and dice as three separate facts, so the template can put
		// the outcome where it reads — a badge on the dice line — instead of in the headline.
		const card = {
			name: request.titleFor(statKey),
			dice: this._display.build(roll, {
				rollMode: effectiveMode,
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
			{name: request.label, description: request.description, moveResults: request.moveResults},
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

	/**
	 * Evaluate stated dice, with no result tiers — winter's `1d4+Population`.
	 *
	 * Not every roll a move calls for is a 2d6 that lands on 10+/7-9/6-. Winter opens by rolling
	 * 1d4+Population to see what the season costs, and the answer is a NUMBER: reading it as a move
	 * result would put "success" on a 10 that means ten Surplus gone.
	 *
	 * Rolling and REPORTING are two calls rather than one, because what the roll did is part of what
	 * the card says: a season step moves Surplus by what the dice came to, and the caller has to
	 * apply that before there is anything to report. The evaluated roll comes back so it can.
	 */
	async evaluateFormula(formula) {
		return new Roll(formula).evaluate();
	}

	/** Post what one of those rolls came to, and what it did — a FormulaRollCard. */
	async postFormulaCard(card) {
		const speaker = ChatMessage.getSpeaker({actor: this._actor});
		const content = await renderRollCard({
			name:    card.name,
			dice:    this._display.build(card.roll, {formula: card.formula}),
			applied: card.applied,
		}, this._rollData);
		return ChatMessage.create({speaker, content, rolls: [card.roll]});
	}

	_rollingFormula(rollMode, bonus) {
		switch (rollMode) {
			case "adv": return `3d6kh2 + ${bonus}`;
			case "dis": return `3d6kl2 + ${bonus}`;
			default:    return `2d6 + ${bonus}`;
		}
	}

	async _prompt(request) {
		const typed  = this._actor.typedActor;
		const extras = {
			rollerName: this._actor.name,
			rollerNote: typed.directoryNote ?? null,
			notes:      await typed.rollNotesFor(request.moveSlug),
			rule:       await typed.rollModeRule(),
		};
		if (request.stat === "ask") return RollPrompt.forChoice(request.label, typed.getRollableStats(), extras);
		return RollPrompt.forStat(request.label, this._statFor(request.stat), extras);
	}

	// A rating the actor does not own — the steading's Fortunes, rolled for Requisition — is named as
	// the chat card names it.
	_statFor(statKey) {
		if (statKey === "prompt") return null;
		const typed = this._actor.typedActor;
		return typed.getRollableStats().find(s => s.key === statKey)
			?? new RollableStat(statKey, statKey.toUpperCase(), typed.resolveBonus(statKey));
	}
}
