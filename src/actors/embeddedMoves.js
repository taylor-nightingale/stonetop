import {
	MoveSnapshotBuilder,
	ValueMax,
} from "../model/snapshot/character/MoveSnapshot.js";
import { ChoiceValues } from "../model/snapshot/character/ChoiceGroup.js";
import { buildChoiceGroup } from "../model/snapshot/character/buildChoiceGroup.js";
import { rich } from "../model/snapshot/RichText.js";
import { toSlug } from "../utils/slug.js";

// Generic mechanics for moves stored as embedded `move` items on an actor — shared by characters
// (basic/playbook/insert/other categories) and steadings (homefront). The domain classes
// (CharacterMoves, SteadingMoves) COMPOSE these; the category vocabulary and seeding decisions stay
// with them. Nothing here knows about a specific actor type.

// A move's identity. `system.slug` is authoritative; toSlug(name) is the fallback for legacy items
// that were embedded before slugs were stamped. Never match a move on its name alone — the name is
// localized in a translated world and the slug is not, so the two disagree by design.
export function moveSlugOf(item) {
	return item?.system?.slug ?? toSlug(item?.name ?? "");
}

// Stamp the category/acquisition fields onto a move document object before it is embedded. `acquired`
// seeds it as owned (instanceCount 1) — a move seeded acquired renders checked-by-default but stays a
// normal, toggleable move (unless the caller renders it locked).
export function withCategoryFields(obj, categoryKey, acquired = true, opts = {}) {
	const instanceCount = acquired ? 1 : 0;
	return {
		...obj,
		system: {
			...obj.system,
			moveType:      categoryKey,
			categoryKey,
			acquired,
			instanceCount,
			sortOrder:     opts.sortOrder     ?? null,
			compendiumId:  opts.compendiumId  ?? null,
			categoryLabel: opts.categoryLabel ?? null,
			categoryNote:  opts.categoryNote  ?? null,
		},
	};
}

export function findMoveItem(actor, categoryKey, moveSlug) {
	return [...actor.items].find(
		i => i.type === "move" && i.system?.categoryKey === categoryKey && moveSlugOf(i) === moveSlug
	) ?? null;
}

// Category-agnostic lookup, for callers that hold a slug but not the category it was filed under.
export function findMoveItemBySlug(actor, moveSlug) {
	return [...actor.items].find(i => i.type === "move" && moveSlugOf(i) === moveSlug) ?? null;
}

/**
 * The move a rendered row stands for: the actor's own copy when they have taken it, otherwise the
 * pack entry it was rendered from.
 *
 * Not every rendered move is an owned one. The moves an improvement CONFERS are looked up rather
 * than seeded — they belong to the improvement, not to the steading's Moves tab — so their rows
 * carry no owned id, and the two things a row does with its move (roll it, post it to chat) have to
 * reach the pack. An index entry is enough for both: a roll reads the name, the stat and the result
 * tiers, all of which it carries.
 */
export async function resolveMoveBySlug(actor, moveSlug, moveRepo) {
	const owned = findMoveItemBySlug(actor, moveSlug);
	if (owned) return owned;
	const [entry] = await moveRepo?.getMoveEntriesBySlugs([moveSlug]) ?? [];
	return entry ?? null;
}

/**
 * Open the item behind a rendered move row: the actor's own copy when they have taken the move,
 * otherwise the compendium move it was rendered from — the same document the Items sidebar opens.
 *
 * The full DOCUMENT, not the index entry resolveMoveBySlug returns: a sheet renders from a document.
 *
 * Shared by CharacterMoves and SteadingMoves because a move row behaves the same on every sheet that
 * shows one. Returns false when there is nothing to open: an arcanum's inline move is text on the
 * arcanum, not an item of its own.
 */
export async function openMoveSheet(actor, moveSlug, moveRepo) {
	const doc = findMoveItemBySlug(actor, moveSlug) ?? await moveRepo?.getMoveDocumentBySlug(moveSlug) ?? null;
	if (!doc) return false;
	doc.sheet.render(true);
	return true;
}

export function computeSelectable(item) {
	return (item?.system?.instanceCount ?? 0) < (item?.system?.repeatMax ?? 1);
}

export async function incrementMove(actor, categoryKey, moveSlug) {
	const item = findMoveItem(actor, categoryKey, moveSlug);
	if (!item) return;
	const count = item.system?.instanceCount ?? 0;
	if (count >= (item.system?.repeatMax ?? 1)) return;
	await actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { acquired: true, instanceCount: count + 1 } }]);
}

export async function decrementMove(actor, categoryKey, moveSlug) {
	const item = findMoveItem(actor, categoryKey, moveSlug);
	if (!item) return;
	const count = item.system?.instanceCount ?? 0;
	if (count === 0) return;
	const newCount = count - 1;
	await actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { acquired: newCount > 0, instanceCount: newCount } }]);
}

// Build a MoveSnapshot from an embedded move item. `resourceController` (optional) turns the move's
// resource def into a live ResourceSnapshot keyed by the move slug in the "moves" namespace.
// `requirement` (optional) is the RequirementSnapshot the caller already built — see
// MoveRequirements#snapshotFor. Callers with no character (an item-sheet preview, a steading) pass
// none; those moves carry no requirements.
export function buildMoveSnapshot(item, categoryKey, selectable, resourceController, requirement = null,
                                  rollNotes = null) {
	const sys    = item?.system ?? null;
	const slug   = moveSlugOf(item);
	const resDef = sys?.resource ?? null;
	const resource = resourceController
		? resourceController.buildSnapshot("moves", resDef, slug)
		: null;
	let choices = null;
	if (sys?.choices) {
		const values = new ChoiceValues(sys.pickValues ?? {});
		choices = buildChoiceGroup(sys.choices, values);
	}

	return new MoveSnapshotBuilder()
		.withId(sys?.compendiumId ?? null)
		.withOwnedId(item?._id ?? null)
		.withSlug(slug)
		.withName(item?.name ?? slug)
		.withNameless(sys?.nameless === true)
		.withDescription(rich(sys?.description ?? ""))
		.withRollStat(sys?.rollStat ?? null)
		.withSource({ type: categoryKey })
		.withSelection(new ValueMax(sys?.instanceCount ?? 0, sys?.repeatMax ?? 1))
		.withSelectable(selectable)
		.withRequirement(requirement)
		.withRequiresLabel(requirement?.label ?? null)
		.withResource(resource)
		.withChoices(choices)
		.withSteps(sys?.steps ?? null)
		.withMoveResults(sys?.moveResults ?? null)
		.withRollNotes(rollNotes)
		.build();
}

