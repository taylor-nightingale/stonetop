// Some monster moves bake an Armor value into their name, like the Shellback
// Drake's "Withdraw into its shell (Armor 5)" or "Curl up into a ball (4 armor)".
// On the stat block these read as toggles: clicking the move sets the creature's
// Armor to that value (and shows why), clicking it again reverts. The parsing
// lives here, away from the sheet, so it stays pure and unit-testable.
//
// A digit must sit immediately beside the word "armor", so flavor or tag mentions
// that carry no number — "ignores armor", "rip apart: armor, weapons, flesh",
// "reach through armor" — never read as a boost. "armor" must also stand alone:
// a hyphenated compound like "armor-piercing" or "3 armor-rending claws" is the
// damage descriptor, not a boost, so the (?<![-\w]) / (?![-\w]) guards reject it.

const ARMOR_AFTER  = /(?<![-\w])armor\b\s*:?\s*(\d+)/i;   // "Armor 5", "Armor: 4"
const ARMOR_BEFORE = /(\d+)\s*\barmor\b(?![-\w])/i;       // "4 armor"

/**
 * The Armor value a move name grants, or null when the name isn't an armor
 * boost. Returns just the number — the "why" is the move's own name.
 * @param {string} name
 * @returns {number|null}
 */
export function parseArmorBoost(name) {
	const text  = String(name ?? "");
	const match = text.match(ARMOR_AFTER) ?? text.match(ARMOR_BEFORE);
	return match ? Number(match[1]) : null;
}

/**
 * The move name with a trailing "(... armor ...)" parenthetical stripped, so the
 * armor indicator reads as the action ("Withdraw into its shell") rather than
 * the stat ("Withdraw into its shell (Armor 5)"). Names that state the boost
 * without a parenthetical are returned unchanged.
 * @param {string} name
 * @returns {string}
 */
export function armorBoostLabel(name) {
	const text     = String(name ?? "").trim();
	const stripped = text.replace(/\s*\([^()]*\barmor\b[^()]*\)\s*$/i, "").trim();
	return stripped || text;
}
