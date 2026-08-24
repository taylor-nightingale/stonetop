import { rerenderActorSheets } from "./rerenderSheets.js";

/**
 * A resident, neighbour or place row shows its linked document as a bare `@UUID` content link, which
 * the enricher resolves to the document's CURRENT name (and to broken-link styling once it is gone).
 * So nothing needs syncing when a linked actor is renamed or deleted — the row is simply stale on
 * screen until the steading sheet redraws, which is what these do.
 */

export function onUpdateLinkedActor(actor, changes) {
	if (changes?.name === undefined && changes?.img === undefined) return;
	rerenderSteadingsLinking(actor.uuid);
}

export function onDeleteLinkedActor(actor) {
	rerenderSteadingsLinking(actor.uuid);
}

function rerenderSteadingsLinking(uuid) {
	rerenderActorSheets(actor => actor.type === "steading" && !!actor.typedActor?.linksDocument(uuid));
}
