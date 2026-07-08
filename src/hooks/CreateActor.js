import { applySteadfast, loadSteadfast } from "../actors/steading/applySteadfast.js";

// Seed a brand-new steading with the Stonetop steadfast, so it opens with the same out-of-the-box
// values steadings used to get from hardcoded schema defaults. A steading that already has a steadfast
// (e.g. duplicated, imported, or created from a template) is left alone. Only the creating client runs
// it, once. Post-create (not preCreate) because loading the steadfast from its pack is async.
export async function onCreateActor(document, options, userId) {
	if (document.type !== "steading") return;
	if (game.user?.id !== userId) return;
	if (document.system?.steadfast) return;
	const steadfast = await loadSteadfast("stonetop");
	if (steadfast) await applySteadfast(document, steadfast);
}
