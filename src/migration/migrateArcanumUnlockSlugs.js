// Two minor arcana print two unlock rows that a two-word slug cannot tell apart — the disturbing
// mask's "tell the mask a secret" / "tell the mask ANOTHER PERSON'S secret", and the oversized
// crown's Words of BEING / Words of UNBEING. They shipped with slugs disambiguated by hand, which
// `unlockSlug` cannot reproduce (one keeps a stop word), so the generator now widens a colliding
// slug itself (uniqueUnlockSlugs) and lands on a different spelling than the hand-made one.
//
// A row's slug is its key inside the arcanum's `choiceValues` store — `{ [groupSlug]: { [rowSlug]:
// value } }`, both namespaced by the arcanum slug (see ArcanumData) — so renaming the row without
// moving the stored value silently resets whatever the player had ticked.
//
// Keyed by arcanum slug so an unrelated arcanum with a same-named row is never touched.
export const UNLOCK_SLUG_RENAMES = {
	"disturbing-mask": { "tell-mask-anothers-secret": "tell-mask-another" },
	"oversized-crown": { "learn-words-of-unbeing": "learn-words-unbeing" },
	// unlockSlug used to split on the apostrophe, so a contraction lost its head to the stop list and
	// the slug began mid-word ("it'll take …" → "ll-take"). It now closes the apostrophe up.
	"half-buried-plaque":         { "ll-take": "itll-take" },
	"old-scroll-case":            { "ll-take": "itll-take", "ll-use": "youll-use" },
	"sealed-cave":                { "ll-take": "itll-take" },
	"strange-skull-and-antlers":  { "use-blessed": "use-blesseds" },
	"vellum-scroll":              { "determine-scroll": "determine-scrolls", "acquire-recipe": "acquire-recipes" },
};

/**
 * The `system.choiceValues` update that carries one arcanum's renamed rows over, or null when there
 * is nothing to move. Foundry MERGES object-field updates rather than replacing them, so the old key
 * has to be deleted explicitly with the `-=` prefix or both spellings survive (see
 * [[object-field-updates-merge]]). A row already stored under the new slug wins — re-running this
 * must not clobber a value the player has since set.
 *
 * Pure over a plain `{ slug, choiceValues }`, so it is testable without a Foundry document.
 */
export function renamedUnlockValues({ slug, choiceValues } = {}) {
	const renames = UNLOCK_SLUG_RENAMES[slug];
	const group = choiceValues?.[slug];
	if (!renames || !group) return null;
	const update = {};
	for (const [from, to] of Object.entries(renames)) {
		if (!(from in group)) continue;
		if (!(to in group)) update[to] = group[from];
		update[`-=${from}`] = null;
	}
	return Object.keys(update).length ? { [slug]: update } : null;
}

/** Rename the legacy unlock-row keys on every arcanum this actor owns. */
export async function migrateArcanumUnlockSlugs(actor) {
	const updates = [];
	for (const item of actor.items ?? []) {
		if (item.type !== "arcanum") continue;
		const choiceValues = renamedUnlockValues(item.system);
		if (choiceValues) updates.push({ _id: item._id, system: { choiceValues } });
	}
	if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
	return updates.length;
}
