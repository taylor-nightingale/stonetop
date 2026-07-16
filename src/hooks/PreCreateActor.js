// Before the document persists (updateSource-only territory). Each typed actor owns its own
// pre-create defaults (StonetopNpc: house icon; the others: none) — the hook just dispatches.
export function onPreCreateActor(document, data) {
	document.typedActor?.onPreCreate(data);
}
