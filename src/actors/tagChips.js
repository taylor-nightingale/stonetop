import { editOnly } from "../utils/sheetActions.js";
import { takeTagInputValue } from "../utils/takeTagInputValue.js";
import { TagLabels } from "../model/data/TagLabels.js";

/**
 * Which Selection field a tag chip belongs to.
 *
 * `selection-chips.hbs` is rendered by the character (follower cards, group members, companions)
 * and by the NPC card, and stamps the same `toggleTag` / `tagAdd` names in both. What differs is
 * only the domain call at the end, so the wrap is read once here and each sheet answers
 * `toggleTag(wrap, value)` with its own one-liner.
 */
export class TagWrap {
	static fromElement(el) {
		const wrap = el?.closest?.(".stonetop-tags");
		if (!wrap) return null;
		const { slug, field, memberIndex } = wrap.dataset;
		return new TagWrap(slug ?? null, field ?? null, memberIndex ?? null);
	}

	constructor(slug, field, memberIndex) {
		this.slug = slug;
		this.field = field;
		this.memberIndex = memberIndex;
	}

	/** A chip on one member of a group follower rather than on the follower itself. */
	get isMember() {
		return this.memberIndex !== null && this.memberIndex !== undefined;
	}
}

/** Click action for a sheet's `DEFAULT_OPTIONS.actions`. The sheet supplies `toggleTag`. */
export const TAG_CHIP_ACTIONS = {
	toggleTag: editOnly(function (ev, target) {
		const wrap = TagWrap.fromElement(target);
		if (wrap && target.dataset.tag) return this.toggleTag(wrap, target.dataset.tag);
	}),
};

/** Change handler to merge into a sheet's ChangeActionRouter map. */
export function tagChipChangeHandlers(sheet) {
	return {
		// What a person typed is in the language the chips are shown in; what gets stored has to be the
		// canonical token, or the tag loses both its behaviour and its glossary definition.
		tagAdd: el => {
			const typed = takeTagInputValue(el);
			const wrap  = TagWrap.fromElement(el);
			if (typed && wrap) return sheet.toggleTag(wrap, TagLabels.current.tokenFor(typed));
		},
	};
}
