import { enrichRichTextTree } from "./enrichRichText.js";
import { rich } from "../model/snapshot/RichText.js";

const TEMPLATE = "systems/stonetop/templates/chat/move-roll.hbs";

/**
 * Render a roll/description chat card. The card data carries its game text as RichText
 * (`description`, `resultText`); this runs the one enrich pass over it, then renders the template —
 * so chat cards go through the same rich-text pipeline as the sheets (markdown, @UUID links, rolls).
 */
export async function renderRollCard(data, rollData = {}) {
	await enrichRichTextTree(data, rollData);
	return foundry.applications.handlebars.renderTemplate(TEMPLATE, data);
}

/**
 * Post a description-only chat card (no dice): the move's name + full text, including ALL result
 * tiers when the move has them (a roll card shows only the rolled tier). The one entry point for
 * every "send to chat without rolling" path — sheet chat buttons, stat-less move posts.
 */
export async function postDescriptionCard(speaker, { name, icon = null, description, moveResults = null }, rollData = {}) {
	const card = { name, icon, description: rich(description), results: buildResultTiers(moveResults) };
	return ChatMessage.create({ speaker, content: await renderRollCard(card, rollData) });
}

const TIER_KEYS = ["success", "partial", "failure"];

/** Move results ({success: {label, value}, …}) → ordered card tiers; null when there are none. */
export function buildResultTiers(moveResults) {
	if (!moveResults) return null;
	const tiers = TIER_KEYS
		.map(key => ({ key, tier: moveResults[key] }))
		.filter(({ tier }) => tier?.value)
		.map(({ key, tier }) => ({ key, label: tier.label ?? "", text: rich(tier.value) }));
	return tiers.length ? tiers : null;
}
