// Where a choice-group row lives on the character sheet: inside a possession, an insert, an
// arcanum card, or directly in a snapshot context (playbook/background/move/…). The sheet builds
// one from the DOM (the containers only exist there); StonetopCharacter's setChoice*For methods
// own the routing decision, so no closest()-chain logic leaks into sheet handlers.
export class ChoiceTarget {
	constructor({
		context = null, group = null, option = null, siblingsCsv = null,
		possessionSlug = null, insertItemId = null, arcanumSlug = null,
	} = {}) {
		this.context        = context;
		this.group          = group;
		this.option         = option;
		this.siblingsCsv    = siblingsCsv;
		this.possessionSlug = possessionSlug;
		this.insertItemId   = insertItemId;
		this.arcanumSlug    = arcanumSlug;
	}

	// A choice-group row element (.stonetop-cg-track / -pick / -text) carrying data-cg-* attributes.
	static fromElement(el) {
		const { cgContext, cgGroup, cgOption, cgSiblings } = el.dataset;
		return new ChoiceTarget({
			context:        cgContext  ?? null,
			group:          cgGroup    ?? null,
			option:         cgOption   ?? null,
			siblingsCsv:    cgSiblings ?? null,
			possessionSlug: el.closest("[data-possession-slug]")?.dataset.possessionSlug ?? null,
			insertItemId:   el.closest("[data-insert-item-id]")?.dataset.insertItemId ?? null,
			arcanumSlug:    el.closest(".stonetop-arcanum-card")?.dataset.slug ?? null,
		});
	}

	// The arcana/background follower-check track uses its own attribute names (data-slug is the
	// GROUP, data-option the option) and only routes to an arcanum card when its context says so.
	static fromFollowerCheck(el) {
		const { cgContext, slug, option } = el.dataset;
		return new ChoiceTarget({
			context: cgContext ?? null,
			group:   slug      ?? null,
			option:  option    ?? null,
			arcanumSlug: cgContext === "arcana"
				? el.closest(".stonetop-arcanum-card")?.dataset.slug ?? null
				: null,
		});
	}
}
