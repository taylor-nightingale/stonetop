import { SteadingDefaults } from "./SteadingDefaults.js";

/**
 * A dice expression in the words the sheet uses everywhere else — `@population + 1` → `Population+1`.
 *
 * `change.formula` is authored as a ROLL expression, because that is what it is: `@population` is
 * Foundry's own reference to the rating, and rewriting or translating it would break the roll (see
 * UNTRANSLATED_PATHS). A chip that printed it raw put an `@` on the sheet, where it reads as a typo
 * rather than as a rating — which is what Township's spring Surplus looked like.
 *
 * The spacing closes up with the name. "Population + 1" beside a subject reads as three things in a
 * row; the book writes "Population+1", and so does the clause the chip sits beside.
 *
 * A reference to no rating this system knows is left exactly as authored: a visible `@homebrew` is a
 * legible mistake, where dropping it would silently change what the chip claims.
 */
export function formulaLabel(formula) {
	if (typeof formula !== "string") return "";
	return formula
		.replace(/@(\w+)/g, (raw, slug) => SteadingDefaults.rating(slug)?.title ?? raw)
		.replace(/\s*([+-])\s*/g, "$1")
		.trim();
}
