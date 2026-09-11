import { enrichRichTextTree } from "./enrichRichText.js";
import { rich } from "../model/snapshot/RichText.js";
import { MoveResults } from "../model/data/MoveResults.js";

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

/**
 * Move results ({success: {label, value}, …}) → ordered card tiers; null when there are none.
 *
 * The tiers themselves are MoveResults, which the Seasons Change box reads as well — the card and
 * the box print the same authored results, so neither owns the tier order.
 */
export function buildResultTiers(moveResults) {
	return MoveResults.fromRaw(moveResults)?.tiers ?? null;
}
