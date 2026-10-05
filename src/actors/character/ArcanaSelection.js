import { revealTopInScroller } from "../../utils/revealInScroller.js";

const CARD = ".stonetop-arcana-reader > .stonetop-arcanum-card";
const PICK = ".stonetop-arcana-pick";

/**
 * Which arcanum this sheet's reader has open beside the list (design-system D13). Every card is in
 * the markup and only the chosen one is shown, so choosing draws nothing; the choice is held here
 * because ticking anything on a card re-renders the tab.
 *
 * Sheet-instance state, never the actor's: which card one player is reading is not a fact about the
 * character.
 */
export class ArcanaSelection {
	#slug = null;

	/** Remember a card to show — one that may not be drawn yet, as a dropped arcanum is not. */
	select(slug) {
		this.#slug = slug ?? null;
	}

	/** Show the chosen card in a freshly rendered tree, or the first when the chosen one is gone. */
	restore(root) {
		const cards = [...(root?.querySelectorAll?.(CARD) ?? [])];
		if (!cards.length) return;
		const shown = cards.find(c => c.dataset.slug === this.#slug) ?? cards[0];
		for (const card of cards) card.hidden = card !== shown;
		for (const pick of root.querySelectorAll(PICK))
			pick.setAttribute("aria-current", String(pick.dataset.slug === shown.dataset.slug));
	}

	/** The reader chose a line in the list: show its card, its top in view. */
	choose(root, slug, reveal = revealTopInScroller) {
		this.select(slug);
		this.restore(root);
		const card = root.querySelector(`${CARD}[data-slug="${slug}"]`);
		if (card) reveal(card);
	}
}
