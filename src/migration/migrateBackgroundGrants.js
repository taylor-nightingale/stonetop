import { CharacterMoveGrants } from "../actors/character/CharacterMoveGrants.js";
import { CharacterBackgrounds } from "../actors/character/CharacterBackgrounds.js";
import { BackgroundMoveMarks } from "../actors/character/BackgroundMoveMarks.js";
import { ChoiceGroupControllerFactory } from "../actors/character/ChoiceGroupControllerFactory.js";
import { MovePicks } from "../actors/character/MovePicks.js";
import { ResourceController } from "../actors/character/ResourceController.js";
import { GrantedItems } from "../actors/GrantedItems.js";
import { Background } from "../model/data/character/Background.js";
import { findMoveItem } from "../actors/embeddedMoves.js";
import { info } from "../utils/logger.js";

/**
 * Re-apply what the CHOSEN background grants.
 *
 * migratePlaybookPackData refreshes the embedded playbook's `backgrounds` from the pack, so what a
 * background SAYS is always current. What it cannot do is re-derive what a background HANDS OUT: that
 * was applied once, by CharacterPlaybook#selectBackground, at the moment the player picked it. So
 * every background that gained something afterwards reached nobody already in play — 1.4.0 gave the
 * marshal, ranger and seeker backgrounds their `moves` lists, and 1.4.0 onwards gave `destined`,
 * `missionary` and `prophet` choice groups that grant a move.
 *
 * Ungated and idempotent, because there is no version to gate on: this has to reach every character
 * on every release that touches a background. Runs after migratePlaybookPackData, which is what puts
 * the current definition on the item for this to read.
 */
export async function migrateBackgroundGrants(actor, moveRepo) {
	const pbItem = [...actor.items].find(i => i.type === "playbook") ?? null;
	if (!pbItem) return;

	const playbookData = pbItem.system ?? {};
	const background   = Background.find(playbookData, actor.system?.background?.selected);
	if (!background) return;

	const grantedItems = new GrantedItems(actor);
	const moves        = new CharacterMoveGrants(moveRepo, actor, grantedItems);

	const acquired = await _acquirePlaybookMoves(actor, moves, playbookData.slug, background);
	const created  = await _syncOwnCategory(moves, grantedItems, background);
	await _revokeUnchosen(moves, playbookData, background);
	const marked   = await _moveMarks(actor, moveRepo).ensureMarked(background);

	if (acquired.length || created.length || marked) {
		info(`  [background] ${actor.name}: ${background.label ?? background.slug} — acquired `
			+ `${acquired.length} playbook move(s), granted ${created.length} of its own, `
			+ `marked ${marked} move option(s).`);
	}
}

// The topic the background makes you Well Versed in. Marked only where it is unmarked, with the same
// trade as the moves above: a topic the player deliberately un-ticked comes back.
function _moveMarks(actor, moveRepo) {
	const factory = new ChoiceGroupControllerFactory(actor);
	const picks   = new MovePicks(actor, factory, moveRepo);
	return new BackgroundMoveMarks(picks, new CharacterBackgrounds(actor, factory, new ResourceController(actor), picks));
}

// The moves the playbook already owns that this background makes yours. Untaken ones only: a re-run
// must not push a repeatable move's count up. That does mean a move the player deliberately un-ticked
// comes back, which is the honest trade — nothing distinguishes "un-ticked on purpose" from "never
// granted at all", and for a background move the second is overwhelmingly the common case.
async function _acquirePlaybookMoves(actor, moves, playbookSlug, background) {
	const categoryKey = `playbook-${playbookSlug}`;
	const acquired    = [];
	for (const slug of background.moveSlugs) {
		const item = findMoveItem(actor, categoryKey, slug);
		if (!item || (item.system?.instanceCount ?? 0) > 0) continue;
		await moves.incrementMove(categoryKey, slug);
		acquired.push(slug);
	}
	return acquired;
}

// Moves only this background hands out, in a category of its own. A sync is a diff, so a move the
// background has since gained is created and everything already there is left exactly as the player
// has it. Built and synced in two steps rather than through `addCategory` so the created items come
// back — `addCategory` returns nothing, and there is a count to report.
async function _syncOwnCategory(moves, grantedItems, background) {
	const granted = background.grantedMoveSlugs;
	if (!granted.length) return [];
	const set = await moves.categoryGrants(background.categoryKey, background.label, granted, granted);
	return await grantedItems.sync(set) ?? [];
}

// A background the character did NOT choose must not still be handing out its move. selectBackground
// already does this on a switch; this keeps the invariant true regardless of how the actor got here —
// exactly one background category, the chosen one. Only items stamped to that source are taken back,
// so a move the GM added by hand is never touched.
async function _revokeUnchosen(moves, playbookData, background) {
	for (const other of Background.allFrom(playbookData)) {
		if (other.slug !== background.slug) await moves.removeCategory(other.categoryKey);
	}
}
