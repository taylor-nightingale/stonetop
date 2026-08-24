/**
 * Foundry re-renders a sheet only when its OWN document changes, so a sheet showing something
 * borrowed — a steading's Prosperity on a character sheet, a linked actor's name on a steading —
 * sits stale until something else happens to redraw it. Both hooks nudge the affected sheets here.
 */
export function rerenderActorSheets(wants) {
	for (const actor of globalThis.game?.actors ?? []) {
		if (!actor.sheet?.rendered) continue;
		if (!wants(actor)) continue;
		if (isBeingEdited(actor.sheet)) continue;
		actor.sheet.render();
	}
}

/** A render rebuilds the sheet's form and discards any input the player hasn't submitted
 *  yet — so leave a sheet alone while it holds the keyboard focus. Going momentarily stale on the
 *  sheet its player is editing is harmless; any later render catches it up. */
export function isBeingEdited(sheet) {
	const active = globalThis.document?.activeElement;
	const root = sheet.element?.[0] ?? sheet.element; // jQuery (AppV1) or HTMLElement (AppV2)
	return !!(active && root?.contains?.(active));
}
