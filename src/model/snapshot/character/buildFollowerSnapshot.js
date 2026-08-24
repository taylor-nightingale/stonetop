// Builds a FollowerSnapshot from an npc Item (embedded follower OR a standalone compendium/world
// follower item). Shared by CharacterFollowers (owned followers, live loyalty + inventory catalog)
// and StonetopFollowerSheet (a standalone follower, loyalty from the stored value, no live catalog),
// so the character card and the item sheet render through ONE builder. See reuse-controllers-and-renderers.
//
// `loyaltyCurrent` = the current loyalty pips (from the actor's ResourceController when owned, or the
// item's stored `loyalty.value` for a standalone follower). `inventory` = a pre-built follower
// inventory snapshot (or null when there's no live outfit catalog to render).

import { FollowerSnapshotBuilder } from "./FollowerSnapshot.js";
import { ChoiceValues } from "./ChoiceGroup.js";
import { buildChoiceGroup } from "./buildChoiceGroup.js";
import { ResourceController } from "../../../actors/character/ResourceController.js";
import { Tags } from "../../data/Tags.js";

export function buildFollowerSnapshot(item, { loyaltyCurrent = 0, inventory = null } = {}) {
	const sys    = item.system ?? {};
	const values = new ChoiceValues(sys.choiceValues ?? {});
	return new FollowerSnapshotBuilder()
		.withSlug(sys.slug)
		.withName(item.name)
		.withImg(item.img ?? null)
		.withKind(sys.kind ?? "creature")
		.withTags(Tags.creature(sys.tagList, sys.tagOptions ?? []))
		.withHp(sys.hp?.value ?? 0)
		.withHpMax(sys.hp?.max ?? 0)
		.withArmor(sys.armor ?? "")
		.withDamage(sys.damage ?? "")
		.withInstinct(sys.instinct ?? "")
		.withMoves(sys.moves ?? "")
		.withSpecialQuality(sys.specialQuality ?? "")
		.withCost(sys.cost ?? "")
		.withLoyalty(ResourceController.build({ max: sys.loyalty?.max ?? 3, title: null, labels: [] }, loyaltyCurrent))
		.withDescription(sys.description ?? "")
		.withNotes(sys.notes ?? "")
		.withChoices(sys.choices?.length ? buildChoiceGroup(sys.choices[0], values) : null)
		.withMembers(sys.members ?? [])
		.withMemberSuggestions(sys.memberSuggestions ?? { names: [], tags: [], traits: [] })
		.withMembersNote(sys.membersNote ?? "")
		.withCompanion(sys.companion ?? {})
		.withInventory(inventory)
		.build();
}
