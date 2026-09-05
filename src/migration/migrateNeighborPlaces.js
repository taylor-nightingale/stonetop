import { loadSteadfast } from "../actors/steading/applySteadfast.js";

// A neighbouring place is half definition and half record: its slug, name, subtitle and name pool come
// off the steadfast, while the note beside it is what this table has written down. The steading keeps
// its own copy of the whole row — seeded once, when the steadfast was applied — so a correction to the
// definition never reached a world that had already seeded one.
//
// This puts the definitional half back in step and leaves the record alone: notes stay, and a row the
// current steadfast no longer defines is kept as it stands rather than dropped, because whatever the
// table wrote against it is still theirs.
//
// Ungated and idempotent, like the other steading passes: the runner only fires when the world's
// stored version is behind the system's, and re-running writes the same values back.
export async function migrateNeighborPlaces(actor) {
	const steadfast = actor.system?.steadfast ? await loadSteadfast(actor.system.steadfast) : null;
	const defined = steadfast?.system?.neighborPlaces ?? [];
	if (!defined.length) return;

	const bySlug = new Map(defined.map(place => [place.slug, place]));
	await actor.update({
		"system.neighborPlaces": (actor.system.neighborPlaces ?? []).map(place => {
			const source = bySlug.get(place.slug);
			return source
				? { ...place, name: source.name, subtitle: source.subtitle, names: source.names }
				: { ...place };
		}),
	});
}
