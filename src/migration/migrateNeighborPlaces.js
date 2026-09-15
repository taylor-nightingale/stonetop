import { loadSteadfast } from "../actors/steading/applySteadfast.js";
import { NeighborPlace } from "../actors/steading/NeighborPlace.js";

// Bring a steading's neighbouring places back in step with the steadfast that defines them.
//
// A row is three kinds of thing at once, and this pass treats each as its own (see
// neighborPlaceFields, which both this and applySteadfast follow):
//
//   synced  name, subtitle, names, size — the definition. Taken from the steadfast every time, so a
//           correction to the book reaches a world that seeded its copy years ago.
//   seeded  travel — written only into a blank. The GM playbook's printed times arrive in a world
//           that predates them, and a time the table measured itself is never overwritten.
//   record  note — the table's own words. Never touched.
//
// NeighborPlace.fromDefinition is where that lives; applying a steadfast reads the same call, which
// is the point — when the two stated it separately they came to disagree, and the apply path blanked
// every note.
//
// Rows the steadfast has since ADDED arrive here too, which is the other half of "in step": the
// result is built in the steadfast's own order, and a row the steadfast no longer defines is kept,
// appended after them, because whatever the table wrote against it is still theirs.
//
// Ungated and idempotent, like the other steading passes: the runner only fires when the world's
// stored version is behind the system's, and re-running writes the same values back.
export async function migrateNeighborPlaces(actor) {
	const steadfast = actor.system?.steadfast ? await loadSteadfast(actor.system.steadfast) : null;
	const defined = steadfast?.system?.neighborPlaces ?? [];
	if (!defined.length) return;

	const stored = actor.system.neighborPlaces ?? [];
	const bySlug = new Map(stored.map(place => [place.slug, place]));

	const inStep = defined.map(source => ({ ...NeighborPlace.fromDefinition(source, bySlug.get(source.slug)) }));

	const definedSlugs = new Set(defined.map(source => source.slug));
	const theirs = stored.filter(place => !definedSlugs.has(place.slug)).map(place => ({ ...place }));

	await actor.update({ "system.neighborPlaces": [...inStep, ...theirs] });
}
