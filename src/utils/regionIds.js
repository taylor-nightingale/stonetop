/**
 * The ids of the regions a sheet opens and shuts — minted by the templates (through the `sectionId`
 * and `moveBodyId` helpers) and opened by the sheet from the same functions, so the two can never
 * disagree about a format. Scoped by the sheet's prefix: two sheets open on one actor never collide.
 */

/** A Playbook- or insert-tab section's choosing body. */
export const sectionBodyId = (prefix, key) => `${prefix}-section-${key}`;

/**
 * A move row's text. The same move listed under two categories is two rows, and so is a move in a
 * Moves panel's list being chosen from and the same move in its list at rest.
 */
export const moveBodyId = (prefix, categoryKey, slug, choosing = false) =>
	`${prefix}-move-${categoryKey}-${slug}${choosing ? "-choosing" : ""}`;

/** An improvement card's body — its rows and payoff — which the card's caret opens and shuts. */
export const improvementBodyId = (prefix, slug) => `${prefix}-improvement-${slug}`;

/** A Moves-tab panel's body, which its caret opens and shuts. */
export const movesPanelId = (prefix, categoryKey) => `${prefix}-moves-panel-${categoryKey}`;
