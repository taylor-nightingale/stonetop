// Player-safe hover summaries for proper-noun lore terms (chiefly the four gods)
// that appear as bare words in the character-creation dialogs — the onboarding
// wizard's "Initiates of Danu" heading and the Introductions prompts.
//
// As with the Well Versed topic summaries, the text is the common knowledge drawn
// from each term's (GM-only) Lore journal `flags.stonetop.summary`, kept here in
// code because a player's client never receives that pack. Keys are lower-cased to
// match the onboarding dialog's _lookupWord; some phrases alias to a god's summary.

const DANU =
	"Danu — the Great Mother, the Goddess, She-Who-Provides — is one of the four main gods of Stonetop. She is the deity of the earth and the wild places, of beasts and birds, of green growing things. She has long been revered by all peoples, though not always worshipped, nor served by priests.";
const ARATIS =
	"Aratis is one of the four main gods of Stonetop, the patron god of civilization and records, of laws and wisdom, of order over chaos. Her disciples say that she has been with us since people first stacked stone upon stone and called it home.";
const HELIOR =
	"Helior is one of the four main gods of Stonetop. He is the god of the sun and light, beacon of hope and mercy, the fiery foe of the dark.";
const TOR =
	"Tor, the Rain-maker, also called the Thunderhead and Slayer-of-Beasts, is one of the four main gods of Stonetop. He is the god of wind and rain, weather and storms, patron of warriors and hunters too.";

export const LORE_TERM_TOOLTIPS = {
	"danu":        DANU,
	"the goddess": DANU,
	"aratis":      ARATIS,
	"helior":      HELIOR,
	"tor":         TOR,
};

// Terms to auto-wrap in authored prose, as they appear in text (preserving case).
// Each maps to a key in LORE_TERM_TOOLTIPS. Deliberately a curated list rather than
// every key — so short/ambiguous words aren't wrapped, and only the phrasings that
// actually occur in the dialogs are matched.
const WRAP_TERMS = {
	"Danu":        "danu",
	"the goddess": "danu",
	"Aratis":      "aratis",
	"Helior":      "helior",
};

// One alternation, longest term first so "the goddess" wins over any substring, and
// a single pass so summary text inserted into data-tooltip is never re-scanned.
const _WRAP_RE = new RegExp(
	"(" + Object.keys(WRAP_TERMS)
		.sort((a, b) => b.length - a.length)
		.map(t => `\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`)
		.join("|") + ")",
	"g",
);

function _escapeAttr(text) {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

/**
 * Wrap known lore proper nouns in an authored HTML string with a `data-tooltip`
 * span so they show their player-safe summary on hover (Foundry-native tooltip).
 * Safe on our own simple `<strong>`-only prose; not a general DOM walker.
 * @param {string} html
 * @returns {string}
 */
export function wrapLoreTerms(html) {
	if (!html) return html;
	return html.replace(_WRAP_RE, match => {
		const summary = LORE_TERM_TOOLTIPS[WRAP_TERMS[match]];
		if (!summary) return match;
		return `<span class="stonetop-lore-term" data-tooltip="${_escapeAttr(summary)}">${match}</span>`;
	});
}
