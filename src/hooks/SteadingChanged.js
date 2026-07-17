/**
 * Character sheets display steading data (Prosperity on the inventory tab). Foundry only
 * re-renders a sheet when its own actor changes, so edits on the steading sheet would
 * otherwise sit stale on open character sheets until something else re-rendered them.
 * Re-render open character sheets whenever a steading's displayed fields change, or a
 * steading appears/disappears.
 */

export function onUpdateActor(actor, changes) {
	if (actor.type !== "steading") return;
	const sys = changes?.system ?? {};
	if (sys.attributes?.prosperity === undefined && sys.debilities === undefined && changes?.name === undefined) return;
	rerenderCharacterSheets();
}

export function onSteadingCreatedOrDeleted(actor) {
	if (actor.type !== "steading") return;
	rerenderCharacterSheets();
}

function rerenderCharacterSheets() {
	for (const actor of globalThis.game?.actors ?? []) {
		if (actor.type !== "character" || !actor.sheet?.rendered) continue;
		if (isBeingEdited(actor.sheet)) continue;
		actor.sheet.render();
	}
}

/** A render rebuilds the sheet's form and discards any input the player hasn't submitted
 *  yet — so leave a sheet alone while it holds the keyboard focus. Prosperity going
 *  momentarily stale on the sheet its player is editing is harmless; any later render
 *  catches it up. */
function isBeingEdited(sheet) {
	const active = globalThis.document?.activeElement;
	const root = sheet.element?.[0] ?? sheet.element; // jQuery (AppV1) or HTMLElement (AppV2)
	return !!(active && root?.contains?.(active));
}
