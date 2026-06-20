// Build the render snapshot for ONE arcanum card. Extracted verbatim from
// CharacterArcana.buildSnapshot so the character sheet AND the arcanum item-sheet live preview render
// through exactly the same code (+ the same arcanum-cards.hbs partial). `arcanum` is an Arcanum model
// (src/model/data/character/Arcanum.js). The character passes its real flip/choice/stat/resource
// values; the preview passes defaults (empty values, no followers/stats).
import {
	ArcanumBackSnapshotBuilder, ArcanumFrontSnapshotBuilder, ArcanumSnapshotBuilder,
	ChoiceGroup, ChoiceValues,
} from "../../model/snapshot/character/CharacterSnapshot.js";
import { ResourceController } from "./ResourceController.js";

// Shape an arcanum side's item like an OutfitItemSnapshot so it renders through the shared
// outfit-item-row partial. `slug` is the ARCANUM slug (the checkbox/resource toggle the character's
// inventory keyed by arcanum slug), and `checked` is the arcanum's owned/checked state.
export function buildArcanumOutfitItem(slug, itemData, resolvedResource = undefined, checked = false) {
	if (!itemData) return null;
	return {
		slug,
		name:            itemData.name,
		weight:          itemData.weight ?? null,
		tags:            itemData.tags ?? null,
		note:            itemData.note ?? null,
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
	unlockValues     = new ChoiceValues({}),
	backChoiceValues = new ChoiceValues({}),
	followersBySlug  = {},
	stats            = new Map(),   // empty Map is safe for both `.get(x)` and `[x]?.value` access
	current          = 0,
	checked          = false,
	owned            = true,
} = {}) {
	const item = arcanum;

	// Unlock/back-choice VALUES are keyed by the ARCANUM slug (see migrateArcana + the card's
	// cgGroup=slug writes). Canonical packs author the group slug == arcanum slug so it lines up,
	// but a custom arcanum's group keeps its literal slug ("unlock"/"choices"); force the namespace
	// to the arcanum slug so reads match the writer regardless of how the group was authored.
	const unlock = item.front.unlock
		? ChoiceGroup.fromPackData({ ...item.front.unlock, slug: item.slug }, unlockValues)
		: null;

	const front = new ArcanumFrontSnapshotBuilder()
		.withTitle(item.front.title)
		.withItem(buildArcanumOutfitItem(item.slug, item.front.item, undefined, checked))
		.withDescription(item.front.description)
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
		? ChoiceGroup.fromPackData({ ...item.back.choices, slug: item.slug }, backChoiceValues, followersBySlug)
		: null;

	const consequences = item.back.consequences
		? ChoiceGroup.fromPackData(item.back.consequences, new ChoiceValues({}))
		: null;

	const back = new ArcanumBackSnapshotBuilder()
		.withTitle(item.back.title)
		.withItem(buildArcanumOutfitItem(item.slug, item.back.item, backItemResource, checked))
		.withDescription(item.back.description)
		.withResource(backResource)
		.withChoices(backChoices)
		.withMoves(item.back.moves)
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
