import { InventoryOwner } from "./InventoryOwner.js";

/**
 * Every `data-change-action` the character sheet's templates emit, mapped to the ONE named method
 * on the typed character that persists it.
 *
 * Each entry reads values off the changed element and calls a single domain method — parsing, pip
 * math and routing live on StonetopCharacter, tested there. Kept out of the sheet because it is a
 * lookup table with no dependency on the sheet at all.
 *
 * @param char  the typed StonetopCharacter.
 */
export function characterChangeHandlers(char) {
	return {
		// vitals + header
		hp:       el => char.setHP(el.value),
		maxHp:    el => char.setMaxHP(el.value),
		damage:   el => char.setDamage(el.value),
		armor:    el => char.setArmor(el.value),
		xp:       el => char.setXP(el.value),
		level:    el => char.setLevel(el.value),
		debility: el => char.setDebility(el.dataset.slug, el.checked),
		rollMode: el => char.setRollMode(el.value),

		// playbook tab
		selectPlaybook:   el => char.applyPlaybookBySlug(el.value),
		selectBackground: el => char.selectBackground(el.value),
		selectOrigin:     el => char.origin.select(el.value),
		instinctCustom:   el => char.selectCustomInstinct(el.value.trim(),
			el.closest("[data-insert-item-id]")?.dataset.insertItemId ?? null),
		arcanumBlank:  el => {
			const card = el.closest(".stonetop-arcanum-card");
			if (card) return char.setArcanumBlank(card.dataset.slug, el.dataset.blankKey, el.value);
		},

		// inventory (the character's own tab and a follower's catalog render the same partial)
		inventoryItemCheck: el => char.setInventoryItemCheckedFor(InventoryOwner.fromElement(el), el.dataset.slug, el.checked),
		regularPool:        el => char.toggleInventoryRegularPool(el.dataset.index, el.checked),
		smallPool:          el => char.toggleInventorySmallPool(el.dataset.index, el.checked),
		inventoryOtherItems: el => char.setInventoryOtherItems(el.value),

		// possessions
		possessionCheck:    el => char.setPossessionSelected(el.dataset.slug, el.checked),

		// notes
		bio:       el => char.setBio(el.value),
		charNotes: el => char.setNotes(el.value),

		// followers
		followerName:    el => char.setFollowerName(el.dataset.slug, el.value),
		// Current HP is clamped against the max, which the player may have just typed into the
		// sibling field — read it live rather than from the (stale) rendered max.
		followerHp:      el => char.setFollowerHp(el.dataset.slug, el.value,
			el.closest(".stonetop-follower-card")?.querySelector(".stonetop-follower-hp-max")?.value ?? el.max),
		followerHpMax:   el => char.setFollowerHpMax(el.dataset.slug, Number(el.value)),
		followerArmor:   el => char.setFollowerArmor(el.dataset.slug, el.value),
		followerDamage:  el => char.setFollowerDamage(el.dataset.slug, el.value),
		followerInstinct: el => char.setFollowerInstinct(el.dataset.slug, el.value),
		companionType:   el => char.setFollowerCompanionType(el.dataset.slug, el.value),
		followerMoves:   el => char.setFollowerMoves(el.dataset.slug, el.value),
		followerCost:    el => char.setFollowerCost(el.dataset.slug, el.value),
		followerNotes:   el => char.setFollowerNotes(el.dataset.slug, el.value),
		followerSpecialQuality: el => char.setFollowerSpecialQuality(el.dataset.slug, el.value),
		followerDescription:    el => char.setFollowerDescription(el.dataset.slug, el.value),
		memberName:  el => char.setFollowerMemberName(el.dataset.slug, Number(el.dataset.index), el.value),
		memberHp:    el => char.setFollowerMemberHp(el.dataset.slug, Number(el.dataset.index), el.value),
		memberHpMax: el => char.setFollowerMemberHpMax(el.dataset.slug, Number(el.dataset.index), el.value),
	};
}
