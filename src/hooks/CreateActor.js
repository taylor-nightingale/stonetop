// Post-create, once, on the creating client only — async pack loads are why this can't run
// preCreate. Each typed actor owns its own creation logic (StonetopSteading: default steadfast +
// homefront moves; StonetopCharacter: reference moves; StonetopNpc: nothing) — the hook just
// dispatches. `?.` covers actor types with no typed class, not a capability probe.
export async function onCreateActor(document, options, userId) {
	if (game.user?.id !== userId) return;
	await document.typedActor?.onCreate();
}
