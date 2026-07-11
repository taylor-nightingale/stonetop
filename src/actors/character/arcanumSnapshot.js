// Build the render snapshot for ONE arcanum card. Extracted verbatim from
// CharacterArcana.buildSnapshot so the character sheet AND the arcanum item-sheet live preview render
// through exactly the same code (+ the same arcanum-cards.hbs partial). `arcanum` is an Arcanum model
// (src/model/data/character/Arcanum.js). The character passes its real flip/choice/stat/resource
// values; the preview passes defaults (empty values, no followers/stats).
import {
	ArcanumBackSnapshotBuilder, ArcanumFrontSnapshotBuilder, ArcanumSnapshotBuilder,
	ChoiceGroup, ChoiceValues,
} from "../../model/snapshot/character/CharacterSnapshot.js";
import { MoveSnapshotBuilder, ValueMax } from "../../model/snapshot/character/MoveSnapshot.js";
import { rich } from "../../model/snapshot/RichText.js";
import { ResourceController } from "./ResourceController.js";

// Shape a major-arcanum back "mystery move" ({id, name, text, subtitle?}) as a MoveSnapshot so it
// renders through the SAME move-item partial as the moves tab. This is the fallback for minor/custom
// arcana that carry inline back.moves (no owned move item), so it's always active ({1,1}, checkbox
// suppressed) and non-rollable (no ownedId/rollStat). MAJOR arcana bypass this: their mystery moves are
// real owned move items resolved via CharacterMoves (moveSnapshots), which carry ownedId + rollStat.
export function buildArcanumMoveSnapshot(move) {
	return new MoveSnapshotBuilder()
		.withId(move.id ?? null)
		.withOwnedId(null)
		.withSlug(move.id ?? null)
		.withName(move.name ?? "")
		.withDescription(rich(move.text ?? ""))
		.withRollStat(null)
		.withSource({ type: "arcanum" })
		.withSourceLabel(move.subtitle || null)
		.withSelection(new ValueMax(1, 1))
		.withSelectable(false)
		.withRequirement(null)
		.withRequiresLabel(null)
		.withResource(null)
		.withChoices(null)
		.build();
}

// Shape an arcanum side's item like an OutfitItemSnapshot so it renders through the shared
// outfit-item-row partial. `slug` is the ARCANUM slug (the checkbox/resource toggle the character's
// inventory keyed by arcanum slug), and `checked` is the arcanum's owned/checked state.
export function buildArcanumOutfitItem(slug, itemData, resolvedResource = undefined, checked = false) {
	if (!itemData) return null;
	return {
		slug,
		name:            itemData.name,
		weight:          itemData.weight ?? null,
		tags:            rich(itemData.tags ?? null),
		note:            rich(itemData.note ?? null),
		inventoryColumn: itemData.inventoryColumn ?? null,
		twoCol:          itemData.twoCol ?? false,
		resource:        resolvedResource !== undefined ? resolvedResource : (itemData.resource ?? null),
		checked,
		isCustom:        false,
		ownedId:         null,
	};
}

export function buildArcanumSnapshot(arcanum, {
	flipped          = false,
	choiceValues     = new ChoiceValues({}),
	followersBySlug  = {},
	stats            = new Map(),   // empty Map is safe for both `.get(x)` and `[x]?.value` access
	current          = 0,
	checked          = false,
	owned            = true,
	moveSnapshots    = null,        // major arcana: real `move`-item snapshots resolved by the caller
} = {}) {
	const item = arcanum;

	// Every choice group on the arcanum (front.unlock, back.choices, back.consequences) reads and
	// writes the ONE `choiceValues` store by its OWN slug — the same generic path inserts use. No
	// forced namespaces, no per-group stores.
	const unlock = item.front.unlock
		? ChoiceGroup.fromPackData(item.front.unlock, choiceValues)
		: null;

	const front = new ArcanumFrontSnapshotBuilder()
		.withTitle(rich(item.front.title))
		.withItem(buildArcanumOutfitItem(item.slug, item.front.item, undefined, checked))
		.withTags(item.front.tags)
		.withDescription(rich(item.front.description))
		.withUnlock(unlock)
		.build();

	const backDef = item.back.resource ?? null;
	const backResource = backDef
		? ResourceController.build({
			...backDef,
			max: backDef.maxStat ? (stats.get(backDef.maxStat) ?? 0) : backDef.max,
		}, current)
		: null;

	const backItemDef = item.back.item?.resource ?? null;
	const backItemResource = backItemDef
		? ResourceController.build({
			...backItemDef,
			max: backItemDef.maxStat ? (stats[backItemDef.maxStat]?.value ?? 0) : backItemDef.max,
		}, current)
		: null;

	const backChoices = item.back.choices
		? ChoiceGroup.fromPackData(item.back.choices, choiceValues, followersBySlug)
		: null;

	const consequences = item.back.consequences
		? ChoiceGroup.fromPackData(item.back.consequences, choiceValues)
		: null;

	const back = new ArcanumBackSnapshotBuilder()
		.withTitle(rich(item.back.title))
		.withItem(buildArcanumOutfitItem(item.slug, item.back.item, backItemResource, checked))
		.withDescription(rich(item.back.description))
		.withResource(backResource)
		.withChoices(backChoices)
		// Major arcana render their mystery moves as real `move` items (passed in as moveSnapshots);
		// minor/custom arcana fall back to the inline back.moves shape.
		.withMoves(moveSnapshots ?? (item.back.moves ?? []).map(buildArcanumMoveSnapshot))
		.withConsequences(consequences)
		.withUnlockAt(item.back.unlockAt)
		.build();

	return new ArcanumSnapshotBuilder()
		.withSlug(item.slug)
		.withMajor(item.major)
		.withName(item.name)
		.withImg(item.img)
		.withFront(front)
		.withBack(back)
		.withOwned(owned)
		.withFlipped(flipped)
		.withChecked(checked)
		.build();
}
