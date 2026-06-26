import { maybePromptAsteriskMove } from "../actors/character/WouldBeHeroAsterisk.js";
import { escHtml } from "./strings.js";
import { stonetopCardShell, stonetopChatCard, springRollCardBody, rollFormulaChip, rollResultNumber } from "./chat.js";

const _STAT_LABELS = {
	str: "Strength", dex: "Dexterity", int: "Intelligence",
	wis: "Wisdom", con: "Constitution", cha: "Charisma",
};

function _rollFormula(rollMode, modifier = 0) {
	const dice = rollMode === "adv" ? "3d6kh2" : rollMode === "dis" ? "3d6kl2" : "2d6";
	return modifier !== 0 ? `${dice}+@stat+@mod` : `${dice}+@stat`;
}

/**
 * Classify a 2d6 PbtA total into its tier: success (10+) / partial (7-9) / failure (6-).
 * `key` doubles as the chat-card result CSS class.
 */
export function classifyResult(total) {
	if (total >= 10) return { key: "success", label: "Strong Hit" };
	if (total >= 7)  return { key: "partial", label: "Weak Hit"   };
	return                   { key: "failure", label: "Miss"       };
}

export function sign(n) { return n >= 0 ? `+${n}` : `${n}`; }

// The spring Seasons Change result table (Book I): the rolling PC picks a seasonal
// gain on a 7+. Shared by the Spring Burst walkthrough, the steading's Seasons Change
// flow, and the chat "ask the most hopeful to roll" prompt so all three stay in step.
export const SPRING_SEASONS_RESULT = {
	success: { label: "10+",       line: "Pick <strong>one seasonal gain</strong>." },
	partial: { label: "7&ndash;9", line: "Pick <strong>one seasonal gain</strong>, but a threat to the steading makes itself known or gets worse." },
	failure: { label: "6-",        line: "<strong>Threats abound</strong> &mdash; and don't mark XP." },
};

/**
 * Pull the individual die faces out of an evaluated Roll, e.g. a 2d6 that came up
 * 2 and 3 yields "2 3". Discarded dice (the dropped die on adv/dis) are flagged with
 * a strike-through so the hover readout still shows what was rolled. Returns "" when
 * the roll has no dice terms.
 */
export function dieResultsText(roll) {
	const dice = roll?.dice ?? [];
	const faces = dice.flatMap(term =>
		(term.results ?? []).map(r => (r.active === false || r.discarded ? `(${r.result})` : `${r.result}`))
	);
	return faces.join(" ");
}

/** Die faces for a *multi*-die roll ("2 4"), or "" for a single die — the readout
 *  only helps when more than one die contributed (a 1d6 just echoes its total). */
export function multiDieFaces(roll) {
	const faces = dieResultsText(roll);
	return faces.includes(" ") ? faces : "";
}

/**
 * Roll a Seasons-Change-style omen card (Spring Burst's first spring, the
 * Expedition's Requisition): evaluate `formula`, classify the tier, post a
 * `stonetop-spring-card` to chat, and hand back `{ total, tier, label }` so the
 * walkthrough can highlight the matching outcome. `resultTable` maps each tier
 * key to `{ label, line }`. Keeps the two cards in lockstep by construction.
 *
 * Speaker/title: pass `title` to head the card with it (like a stat roll's
 * "Dexterity") and speak the card as whoever made the roll (ChatMessage.getSpeaker) —
 * used by the chat "Roll +Fortunes" button, so the result is spoken by the player who
 * clicked it. Pass `alias` instead to speak the card under a fixed name with no header
 * (the Expedition Requisition card).
 */
export async function rollSeasonsCard({ formula, title = "", alias = "", resultTable } = {}) {
	const roll = await new Roll(formula).evaluate();
	const tier = classifyResult(roll.total).key;
	const result = resultTable[tier];
	const body = springRollCardBody(roll.total, tier, result.label, result.line, roll.formula, multiDieFaces(roll));
	await roll.toMessage({
		speaker: alias ? { alias } : ChatMessage.getSpeaker(),
		flavor:  title
			? stonetopChatCard(title, body, "stonetop-spring-card")
			: stonetopCardShell(body, "stonetop-spring-card"),
	});
	return { total: roll.total, tier, label: result.label };
}

/**
 * Post a chat card asking the most hopeful character's player to make the spring
 * Seasons Change roll (+Fortunes). The card carries a button anyone at the table can
 * click to roll it (wired in stonetop.js `_chatWireSeasonsRoll`, which rolls 2d6 +
 * the carried Fortunes against SPRING_SEASONS_RESULT). `hopeful` is the recorded
 * "most hopeful" note, if any; `fortunes` is the steading's +Fortunes modifier.
 */
export function postSeasonsRollPrompt({ alias = "Seasons Change — Spring", hopeful = "", fortunes = 0 } = {}) {
	if (!globalThis.ChatMessage) return;
	const who = hopeful ? `<strong>${escHtml(hopeful)}</strong>` : "Whoever is the <strong>most hopeful</strong>";
	const body = `<div class="card-content stonetop-seasons-prompt">
		<p class="stonetop-seasons-prompt-text">Spring bursts forth! ${who}, roll <strong>+Fortunes</strong> (${sign(fortunes)}) for the <em>Seasons Change</em>.</p>
		<div class="card-buttons stonetop-card-buttons">
			<button type="button" class="stonetop-seasons-roll-btn" data-fortunes="${fortunes}" data-alias="${escHtml(alias)}">
				<i class="fas fa-dice-d6"></i> Roll +Fortunes (${sign(fortunes)})
			</button>
		</div>
	</div>`;
	ChatMessage.create({
		speaker: { alias },
		content: stonetopChatCard(alias, body, "stonetop-seasons-prompt-card"),
	});
}

function _rollCard({ header, result = "", resultClass = "", resultDetail = "", resultOutcomes = null, conditionsHtml = "", buttons = false, total = null, formula = "", description = "", dieResults = "" }) {
	// Stash every tier's outcome on the row so a GM Shift Up/Down can swap the
	// detail line to match the new tier (see _shiftRollCardFlavor in stonetop.js).
	const outcomeAttrs = resultOutcomes
		? ` data-outcome-success="${escHtml(resultOutcomes.success ?? "")}"`
			+ ` data-outcome-partial="${escHtml(resultOutcomes.partial ?? "")}"`
			+ ` data-outcome-failure="${escHtml(resultOutcomes.failure ?? "")}"`
		: "";
	// The die formula gets its own chip above the result, mirroring Foundry's vanilla
	// dice-formula placement. We hide Foundry's auto-rendered dice block in CSS, so
	// this is the only place the formula appears. The chip carries the individual die
	// faces ("2 4") as a hover tooltip — hovering "2d6" to see what the d6s came up is
	// the intuitive spot (the total below carries the same readout for discoverability).
	const formulaHtml = formula ? rollFormulaChip(formula, dieResults) : "";

	// One left-edge result block: the rolled total plus (for move / Death's-Door rolls)
	// the hit tier and its per-tier outcome, colour-coded down the left edge. Replaces
	// the old separate centred readout + boxed "Weak Hit" label. Cards without a roll
	// (e.g. the "+1 XP on a miss" follow-up) pass no total and just show the label.
	const resultBlockHtml = (total != null || result)
		? `<div class="stonetop-roll-result ${resultClass}"${outcomeAttrs}>
			${total != null ? rollResultNumber(total, dieResults) : ""}
			<div class="stonetop-roll-result-body">
				${result ? `<span class="stonetop-roll-result-label">${result}</span>` : ""}
				<span class="stonetop-roll-result-details">${escHtml(resultDetail)}</span>
			</div>
		</div>`
		: "";
	const bodyHtml = (formulaHtml || resultBlockHtml)
		? `<div class="card-content">${formulaHtml}${resultBlockHtml}</div>`
		: "";
	const descriptionHtml = description
		? `<div class="stonetop-roll-card-description">${description}</div>`
		: "";
	const descToggleHtml = description
		? `<button class="stonetop-roll-card-desc-toggle" type="button" title="Show move description"><i class="fas fa-question-circle"></i></button>`
		: "";
	const buttonsHtml = buttons
		? `<div class="card-buttons stonetop-card-buttons">
			<button data-action="shiftDown"><i class="fas fa-arrow-down"></i> Shift Down</button>
			<button data-action="shiftUp"><i class="fas fa-arrow-up"></i> Shift Up</button>
		</div>`
		: "";

	return `<section class="pbta-chat-card stonetop-roll-card">
		<div class="cell cell--chat">
			<div class="chat-title row flexrow">
				<h2 class="cell__title">${header}</h2>
				${descToggleHtml}
			</div>
			${descriptionHtml}
			${bodyHtml}
			${conditionsHtml}
			${buttonsHtml}
		</div>
	</section>`;
}

function _conditionsHtml(conditions) {
	if (!conditions.length) return "";
	const localized = game.i18n?.localize("PBTA.ConditionsApplied");
	const label = localized && localized !== "PBTA.ConditionsApplied" && localized !== "PBTA.CONDITIONSAPPLIED"
		? localized
		: "Conditions Applied:";
	return `<div class="row row--border conditions stonetop-roll-conditions">
		<h3 class="cell__subtitle">${label}</h3>
		<ul>${conditions.join("")}</ul>
	</div>`;
}

/**
 * Roll 2d6+stat for a character move or direct stat roll.
 *
 * @param {string} statKey   - One of str/dex/int/wis/con/cha
 * @param {Actor}  actor
 * @param {object} options
 * @param {string} [options.rollMode]                  - "adv" | "dis" | "def" | "normal"
 * @param {number} [options.modifier]                  - Total numeric modifier (forward + ongoing + situational)
 * @param {number} [options.forward]                   - Forward portion (shown separately in card)
 * @param {number} [options.ongoing]                   - Ongoing portion (shown separately in card)
 * @param {number} [options.statValue]                 - Explicit stat value, for nonstandard actor data
 * @param {string} [options.moveName]                  - Display name for the roll header
 * @param {string}  [options.stonetopDebility]          - Debility name for annotation
 * @param {string}  [options.stonetopDebilityTooltip]
 * @param {boolean} [options.noXpOnMiss]               - Skip the automatic +1 XP on a miss (for moves that replace it)
 * @returns {Promise<Roll>}
 */
export async function rollStat(statKey, actor, options = {}) {
	const statValue  = options.statValue ?? actor.system?.stats?.[statKey]?.value ?? 0;
	const statLabel  = _STAT_LABELS[statKey] ?? statKey.toUpperCase();
	const rollMode   = options.rollMode ?? "normal";
	const moveName   = options.moveName ?? null;
	const modifier   = options.modifier ?? 0;
	const forward    = options.forward  ?? 0;
	const ongoing    = options.ongoing  ?? 0;

	const moveDescription = options.moveDescription ?? "";

	const rollData    = modifier !== 0 ? { stat: statValue, mod: modifier } : { stat: statValue };
	const rollOptions = {
		stonetopDebility:        options.stonetopDebility        ?? null,
		stonetopDebilityTooltip: options.stonetopDebilityTooltip ?? null,
	};

	const roll   = await new Roll(_rollFormula(rollMode, modifier), rollData, rollOptions).evaluate();
	const total  = roll.total;
	const result = classifyResult(total);

	// Surface the move's own per-tier outcome (10+/7-9/6-) on the result card. Some
	// moves (e.g. the Blessed's Borrow Power, Suck the Poison Out) keep their outcomes
	// only in moveResults and omit them from the description, so this is the only place
	// a player would otherwise see them.
	const moveResults    = options.moveResults ?? null;
	const resultOutcomes = moveResults
		? {
			success: moveResults.success?.value ?? "",
			partial: moveResults.partial?.value ?? "",
			failure: moveResults.failure?.value ?? "",
		}
		: null;
	const resultDetail = resultOutcomes?.[result.key] ?? "";

	const header = moveName ?? statLabel;

	// Build condition pills
	const conditions = [];
	if (rollMode === "adv") {
		conditions.push(`<li class="stonetop-condition-advantage">Advantage</li>`);
	} else if (rollMode === "dis") {
		conditions.push(`<li class="stonetop-condition-disadvantage">Disadvantage</li>`);
	}
	if (forward !== 0) {
		conditions.push(`<li class="stonetop-condition-forward">Forward ${sign(forward)}</li>`);
	}
	if (ongoing !== 0) {
		conditions.push(`<li class="stonetop-condition-ongoing">Ongoing ${sign(ongoing)}</li>`);
	}
	const situational = modifier - forward - ongoing;
	if (situational !== 0) {
		conditions.push(`<li class="stonetop-condition-situational">Situational ${sign(situational)}</li>`);
	}

	const conditionsHtml = _conditionsHtml(conditions);

	const flavor = _rollCard({
		header,
		result: result.label,
		resultClass: result.key,
		resultDetail,
		resultOutcomes,
		conditionsHtml,
		buttons: true,
		total: roll.total,
		formula: roll.formula,
		dieResults: dieResultsText(roll),
		description: moveDescription,
	});

	const resultMessage = await roll.toMessage({
		speaker:  ChatMessage.getSpeaker({ actor }),
		flavor,
		rollMode: game.settings.get("core", "rollMode"),
	});

	// Wait for the Dice So Nice 3D animation (if installed) to finish before
	// posting any follow-up cards, so the Miss/XP card doesn't reveal the result
	// while the dice are still rolling. Guard the wait: if DSN rejects (lookup race,
	// internal error), we still must mark the miss XP below, not bail out of rollStat.
	if (resultMessage?.id) {
		try {
			await game.dice3d?.waitFor3DAnimationByMessageID(resultMessage.id);
		} catch (_err) { /* animation wait failed — proceed to the follow-up cards */ }
	}

	if (result.key === "failure" && actor?.type === "character" && !options.noXpOnMiss) {
		const currentXp = actor.system?.attributes?.xp?.value ?? 0;
		const level     = actor.system?.attributes?.level?.value ?? 1;
		const maxXp     = 6 + level * 2;
		const newXp     = currentXp + 1;
		// Attribute the marked XP to the move that missed, so the ledger reads "via <move>".
		await actor.update({ "system.attributes.xp.value": newXp }, moveName ? { stonetopMove: moveName } : {});
		const xpCard = _rollCard({
			header: "Miss",
			result: `+1 XP (${newXp} / ${maxXp})`,
			resultClass: "success",
			description: `<p>On a <strong>miss</strong> (a total of 6 or less), you <strong>mark XP</strong> &mdash; a tick mark that raises your total by 1 &mdash; unless the move says otherwise.</p>`
		});
		await ChatMessage.create({
			content:  xpCard,
			speaker:  ChatMessage.getSpeaker({ actor }),
			rollMode: game.settings.get("core", "rollMode"),
		});
	}

	await maybePromptAsteriskMove(actor, moveName, total);

	return roll;
}

/**
 * Apply advantage/disadvantage to a damage formula by doubling its first dice
 * term and keeping the better/worse half — Stonetop "roll damage twice, take the
 * higher/lower" (e.g. "d6" with disadvantage → "2d6kl1", "d8+2" → "2d8kl1+2").
 * Non-adv/dis modes and dieless formulas pass through unchanged.
 */
function _damageRollFormula(formula, rollMode) {
	if (rollMode !== "adv" && rollMode !== "dis") return formula;
	return String(formula).replace(/(\d*)d(\d+)/i, (match, count, faces) => {
		const n = Number(count || 1);
		const keep = rollMode === "adv" ? "kh" : "kl";
		return `${n * 2}d${faces}${keep}${n}`;
	});
}

/**
 * Roll a character or monster damage formula using the same Stonetop chat card
 * shell as stat rolls.
 *
 * @param {string} formula
 * @param {Actor} actor
 * @param {object} options
 * @param {string} [options.label]
 * @param {string} [options.rollMode]  - "adv" | "dis" | "normal" (advantage/disadvantage on the damage die)
 * @returns {Promise<Roll>}
 */
export async function rollDamage(formula, actor, options = {}) {
	const rollMode = options.rollMode ?? "normal";
	const roll = await new Roll(_damageRollFormula(formula, rollMode)).evaluate();
	const label = options.label ?? "Damage";

	const conditions = [];
	if (rollMode === "adv") {
		conditions.push(`<li class="stonetop-condition-advantage">Advantage</li>`);
	} else if (rollMode === "dis") {
		conditions.push(`<li class="stonetop-condition-disadvantage">Disadvantage</li>`);
	}

	await roll.toMessage({
		speaker:  ChatMessage.getSpeaker({ actor }),
		flavor:   _rollCard({ header: label, buttons: true, total: roll.total, formula: roll.formula, dieResults: dieResultsText(roll), conditionsHtml: _conditionsHtml(conditions) }),
		rollMode: game.settings.get("core", "rollMode"),
	});

	return roll;
}

/**
 * Roll a generic formula using the Stonetop chat card shell.
 *
 * @param {string} formula
 * @param {Actor} actor
 * @param {object} options
 * @param {string} [options.label]
 * @returns {Promise<Roll>}
 */
export async function rollFormula(formula, actor, options = {}) {
	const roll = await new Roll(formula).evaluate();
	const label = options.label ?? formula;
	const description = options.description ?? "";

	await roll.toMessage({
		speaker:  ChatMessage.getSpeaker({ actor }),
		flavor:   _rollCard({ header: label, total: roll.total, formula, buttons: true, dieResults: dieResultsText(roll), description }),
		rollMode: game.settings.get("core", "rollMode"),
	});

	return roll;
}
