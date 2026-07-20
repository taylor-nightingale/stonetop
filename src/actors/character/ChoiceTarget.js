/**
 * Where a choice-group row lives on the character sheet.
 *
 * Two independent things: the CONTAINER (which document holds the values — a possession, an insert, an
 * arcanum card, a follower card, a move) and the GROUP (`data-cg-group`, which store on that document).
 * Value stores are per-document, so a group's slug only has to be unique on its own item — it is never
 * the container's identity, and the two must not be conflated.
 *
 * The sheet builds one from the DOM (the container wrappers only exist there); ChoiceStores turns the
 * context into the controller to write through.
 */
export class ChoiceTarget {
	constructor({
		context = null, group = null, option = null, siblingsCsv = null,
		possessionSlug = null, insertItemId = null, arcanumSlug = null,
		followerSlug = null, moveSlug = null,
	} = {}) {
		this.context        = context;
		this.group          = group;
		this.option         = option;
		this.siblingsCsv    = siblingsCsv;
		this.possessionSlug = possessionSlug;
		this.insertItemId   = insertItemId;
		this.arcanumSlug    = arcanumSlug;
		this.followerSlug   = followerSlug;
		this.moveSlug       = moveSlug;
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
			followerSlug:   el.closest("[data-follower-slug]")?.dataset.followerSlug ?? null,
			moveSlug:       el.closest("[data-move-slug]")?.dataset.moveSlug ?? null,
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
