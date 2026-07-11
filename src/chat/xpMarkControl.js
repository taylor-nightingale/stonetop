/**
 * The "Undo XP mark" control on roll cards.
 *
 * The 6- auto-mark is right by default, but the table sometimes knows better: a GM ruling,
 * a conditional move exception, or the Seeker's Never at a Loss (declining the mark is the
 * player's choice on Know Things rolls). A card that auto-marked XP carries a
 * flags.stonetop.xpMark flag and renders its mark line through buildXpLine; the GM and the
 * rolling player get a link on that line that toggles the mark — undo removes the tick and
 * flips the line to "XP mark undone." with a re-mark link for misclicks.
 */

export function buildXpLine(undone, localize) {
	return undone
		? `<div class="stonetop-roll-xp stonetop-roll-xp--undone">${localize("stonetop.rollResults.xpUndone")} ` +
			`<a class="stonetop-xp-toggle">${localize("stonetop.rollResults.xpRemark")}</a></div>`
		: `<div class="stonetop-roll-xp">${localize("stonetop.rollResults.xpMarked")} ` +
			`<a class="stonetop-xp-toggle">${localize("stonetop.rollResults.xpUndo")}</a></div>`;
}

const XP_LINE = /<div class="stonetop-roll-xp[^"]*">.*?<\/div>/;

export function swapXpLine(content, undone, localize) {
	return content.replace(XP_LINE, buildXpLine(undone, localize));
}

/** renderChatMessageHTML: strip the toggle for users who may not act on it, bind it for the rest. */
export function onRenderChatMessage(message, html) {
	const toggle = html.querySelector?.(".stonetop-xp-toggle");
	if (!toggle) return;
	if (!canToggle(message)) {
		toggle.remove();
		return;
	}
	toggle.addEventListener("click", () => toggleXpMark(message));
}

function canToggle(message) {
	return !!(globalThis.game?.user?.isGM || message.isAuthor);
}

export async function toggleXpMark(message) {
	const flag = message.getFlag("stonetop", "xpMark");
	if (!flag) return;
	const typed = ChatMessage.getSpeakerActor?.(message.speaker)?.typedActor;
	if (!typed) return;
	const undone = !flag.undone;
	// Undo removes the tick; re-mark puts it back through the same clamped path as the
	// original mark. If the actor state moved on (XP spent to 0, track filled), do nothing.
	const applied = undone ? await typed.unmarkXp?.() : await typed.markXp?.();
	if (applied !== true) return;
	await message.update({
		content: swapXpLine(message.content, undone, k => globalThis.game.i18n.localize(k)),
		"flags.stonetop.xpMark": { ...flag, undone },
	});
}
