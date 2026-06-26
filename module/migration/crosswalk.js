// Path B slug CROSSWALK — translates a Taylor-origin character/steading's choice slugs to the fork's
// where they DIVERGE, so migrated selections render SELECTED (the builders copy his slugs verbatim,
// which only hydrate when his slug == the fork's). The fork was authored from the same source as his,
// so it is ~95% slug-identical — this table holds ONLY the genuine RENAMES (same concept, different
// slug). ALIGNED options are omitted (identity). NO-EQUIVALENT options (selections upstream includes
// that this system doesn't surface on that insert, e.g. a few post-death consequence options) have no
// entry and stay inert by design.
//
// Verified per-playbook/insert by decompiling his packs vs the fork's packs/src content. Extend one
// playbook/insert at a time as they're mapped (most are tiny); bump PATH_B_VERSION when this changes
// so already-migrated actors re-pick-up the translation.

// His playbook-lore "group:option" → fork "group:option". Handles group RENAMES too (the-blessed
// splits his merged `the-earth-mother` offerings into a separate `danu-offerings` group).
export const PLAYBOOK_LORE_CROSSWALK = {
	"the-blessed": {
		"the-earth-mother:fruits-of-harvest": "danu-offerings:fruits-of-harvest",
		"the-earth-mother:figurines":         "danu-offerings:figurines",
		"the-earth-mother:whisky":            "danu-offerings:whisky",
		"the-earth-mother:salt":              "danu-offerings:salt",
		"the-earth-mother:rain-water":        "danu-offerings:rain-water",
		"the-earth-mother:metal-nails":       "danu-offerings:metal-nails",
		"the-earth-mother:blood":             "danu-offerings:blood",
		"the-earth-mother:incense":           "danu-offerings:incense",
	},
};

// Which groups in a playbook ITEM's `choiceValues` are LORE (→ the fork's lore.* store). instinct/
// appearance are reserved (handled by their own builders); builder groups (e.g. the-blessed
// sacred-pouch) and backgrounds are NOT lore and are routed by their own (pending) passes.
export const PLAYBOOK_LORE_GROUPS = {
	"the-blessed": ["the-earth-mother"], // offerings live inline under it on his side; split via the crosswalk
};

// Post-death insert lore "group:option" → fork "group:option" renames, per insert slug. Only Thrall
// has renames (slug-spelling); Ghost/Revenant align or are no-equivalent (left inert).
export const INSERT_LORE_CROSSWALK = {
	"thrall": {
		"your-master:name":      "your-master:master-name",
		"impulse:hide-bury":     "impulse:hide-smother",
		"impulse:deprive":       "impulse:deprive-others",
		"impulse:shock-terrify": "impulse:shock-horrify",
		"marks:festering-rot":   "marks:a-festering-rot",
		"marks:speak-truth":     "marks:speak-truth-whisper-secrets",
	},
};

/** Translate a playbook-lore `group:option` key for the given playbook (identity if no rename). */
export function translateLoreKey(playbookSlug, key) {
	return PLAYBOOK_LORE_CROSSWALK[playbookSlug]?.[key] ?? key;
}

/** Translate a post-death-insert lore `group:option` key for the given insert (identity if none). */
export function translateInsertLoreKey(insertSlug, key) {
	return INSERT_LORE_CROSSWALK[insertSlug]?.[key] ?? key;
}

/** The choiceValues groups to treat as lore for this playbook (empty = none mapped yet). */
export function playbookLoreGroups(playbookSlug) {
	return PLAYBOOK_LORE_GROUPS[playbookSlug] ?? [];
}
