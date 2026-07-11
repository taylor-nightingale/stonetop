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
		if (actor.type === "character" && actor.sheet?.rendered) actor.sheet.render();
	}
}
