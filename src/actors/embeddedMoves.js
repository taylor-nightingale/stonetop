import {
	MoveSnapshotBuilder,
	RequirementSnapshot,
	ValueMax,
} from "../model/snapshot/character/MoveSnapshot.js";
import { ChoiceGroup, ChoiceValues } from "../model/snapshot/character/ChoiceGroup.js";
import { rich } from "../model/snapshot/RichText.js";
import { toSlug } from "../utils/slug.js";

// Generic mechanics for moves stored as embedded `move` items on an actor — shared by characters
// (basic/playbook/insert/other categories) and steadings (homefront). The domain classes
// (CharacterMoves, SteadingMoves) COMPOSE these; the category vocabulary and seeding decisions stay
// with them. Nothing here knows about a specific actor type.

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
		i => i.type === "move" && i.system?.categoryKey === categoryKey && toSlug(i.name) === moveSlug
	) ?? null;
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
export function buildMoveSnapshot(item, categoryKey, selectable, requirementsMet, resourceController) {
	const sys    = item?.system ?? null;
	const slug   = sys?.slug ?? toSlug(item?.name ?? "");
	const resDef = sys?.resource ?? null;
	const resource = resourceController
		? resourceController.buildSnapshot("moves", resDef, slug)
		: null;
	let choices = null;
	if (sys?.choices) {
		const values = new ChoiceValues(sys.pickValues ?? {});
		choices = ChoiceGroup.fromPackData(sys.choices, values);
	}
	const req      = sys?.requirement ?? null;
	const reqParts = [...(req?.moves ?? []), req?.level ? `Level ${req.level}` : ""].filter(Boolean);
	const requirement = reqParts.length
		? new RequirementSnapshot(reqParts.join(", "), requirementsMet)
		: null;
	return new MoveSnapshotBuilder()
		.withId(sys?.compendiumId ?? null)
		.withOwnedId(item?._id ?? null)
		.withSlug(slug)
		.withName(item?.name ?? slug)
		.withDescription(rich(sys?.description ?? ""))
		.withRollStat(sys?.rollStat ?? null)
		.withSource({ type: categoryKey })
		.withSourceLabel(null)
		.withSelection(new ValueMax(sys?.instanceCount ?? 0, sys?.repeatMax ?? 1))
		.withSelectable(selectable)
		.withRequirement(requirement)
		.withRequiresLabel(requirement?.label ?? null)
		.withResource(resource)
		.withChoices(choices)
		.build();
}
