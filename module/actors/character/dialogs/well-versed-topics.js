// Player-safe summaries for the Seeker's "Well Versed in …" Background topics, so
// the onboarding step can explain — on hover — what "the Things Below" or "the
// Fae" actually refer to. New players picking a Background often don't know.
//
// The text is the "known by most in Stonetop" common knowledge: each summary is
// drawn from the corresponding Lore journal's "Everyone knows" list. We keep it
// here in code rather than reading the journals at render time on purpose — the
// Lore pack is GM-only, so a player's client never receives those entries, but it
// does receive the playbook that drives this dialog. There is deliberately no
// click-through to the journal: a player couldn't open it, and the summary is all
// the context character creation needs.
//
// Keyed by the lower-cased topic text. Covers the Background move-choices
// (Patriot / Antiquarian / Witch Hunter) and the equivalent Well Versed move
// phrasings, which draw from the same vocabulary. Topics we don't summarise (e.g.
// "the civilizations of humanity") are simply absent and resolve to null.
//
// Some topics are phrased two ways (a Background move-choice and the equivalent
// Well Versed move wording); those share one summary defined once and aliased to
// both keys, so an edit can't drift between the two.
const FAE =
	"Strange, magical folk who dwell in the Great Wood. They vary greatly in appearance, ability, and disposition: dreamlike, fickle, wondrous, and dangerous.";
const LAST_DOOR =
	"The Lady of Crows waits at the Last Door, and tales tell of what lies beyond. Everyone knows a ghost story or two — that dool trees are often haunted, and that most undead walk only at night.";

export const WELL_VERSED_TOPIC_SUMMARIES = {
	// The Things Below
	"the things below":
		"Evil things bound deep within the earth. Now and again they send forth demons to wreak havoc — most likely to emerge from deep water — and Marshedge keeps them at bay by constantly burning bendis root.",
	// The Makers
	"the makers and their arts":
		"The giants who built most of the ruins that dot the land — and the settlements raised upon them, plus the Highway and the West Road. Different groups worked powerful magic, some of which lingers still.",
	// The Fae
	"the fae":                       FAE,
	"the fae and their strange ways": FAE,
	// Death & the Undying / the Last Door
	"the last door and what lies beyond": LAST_DOOR,
	"the last door, death, and the undead": LAST_DOOR,
};

/**
 * Player-safe common-knowledge summary for a Well Versed topic phrase, or null
 * when we don't have one for it.
 * @param {string} topic
 * @returns {string|null}
 */
export function wellVersedTopicSummary(topic) {
	if (!topic) return null;
	return WELL_VERSED_TOPIC_SUMMARIES[String(topic).trim().toLowerCase()] ?? null;
}
