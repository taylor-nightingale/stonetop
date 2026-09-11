import { RollDisplay } from "../utils/rollDisplay.js";
import { renderRollCard } from "../utils/rollCard.js";

/**
 * Foundry's own roll message, redrawn as a Stonetop roll card.
 *
 * `[[/r 1d6]]` in a move's text posts core's roll template — a grey formula bar over a grey total
 * bar — beside our own cards, which is three presentations of the same act in one chat log. The
 * dice a table reads should not depend on which control happened to roll them.
 *
 * Redrawn through the SAME RollDisplay and the same `move-roll.hbs` every other card goes through,
 * rather than restyled in CSS: two descriptions of one card is how they drift.
 *
 * Only core's bare roll message is touched — one roll, and nothing in the content but the roll
 * itself. A system or module that renders its own card has already decided how its rolls look.
 */
export function isBareRollMessage(message, root) {
	if (message?.rolls?.length !== 1) return false;
	const content = root?.querySelector?.(".message-content");
	if (!content) return false;
	const children = [...content.children];
	return children.length === 1 && children[0].classList.contains("dice-roll");
}

/**
 * The card one of those messages becomes.
 *
 * A roll posted with flavour — `[[/r 1d6]]{Damage}` — is titled by it, and the formula drops to the
 * receipt line under the total. A roll posted without has nothing else to be called, so the formula
 * IS the title and the receipt line would say it twice.
 */
export function inlineRollCard(message, localize) {
	const roll = message.rolls[0];
	const flavor = message.flavor?.trim();
	return {
		name: flavor || roll.formula,
		dice: new RollDisplay(localize).build(roll, { formula: flavor ? roll.formula : null }),
	};
}

/** renderChatMessageHTML: redraw core's roll message as ours, in place. */
export async function onRenderRollMessage(message, root) {
	if (!isBareRollMessage(message, root)) return;
	const localize = k => globalThis.game.i18n.localize(k);
	root.querySelector(".message-content").innerHTML =
		await renderRollCard(inlineRollCard(message, localize));
}
