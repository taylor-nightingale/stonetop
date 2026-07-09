// Apply a steadfast's definition to a steading actor: copy the shared profile fields onto the actor
// (independent copies it then edits in play — the character/playbook pattern, where the actor's live
// state lives on the actor, seeded from the definition) and record which steadfast it came from. The
// actor's runtime state (residentPeople, neighborPeople, debilities, content, improvementValues) is
// left untouched.
const PROFILE_FIELDS = ["attributes", "assets", "placesOfInterest", "neighborPlaces", "residents", "improvements"];

export async function applySteadfast(actor, steadfast) {
	const src = steadfast.system;
	const update = { "system.steadfast": src.slug };
	for (const field of PROFILE_FIELDS) update[`system.${field}`] = structuredClone(src[field]);
	// The steadfast's attributes are its starting values; keep an immutable copy so the "Starts at …"
	// notes stay correct after the live `attributes` are edited in play.
	update["system.startingAttributes"] = structuredClone(src.attributes);
	await actor.update(update);
}

// Load a steadfast item from the steadfasts compendium by slug (null if the pack/item is absent).
// Used to seed new steadings (create hook) and, later, to re-apply on drop.
export async function loadSteadfast(slug) {
	const pack = game.packs?.get("stonetop.steadfasts");
	if (!pack) return null;
	const docs = await pack.getDocuments();
	return docs.find(d => d.system?.slug === slug) ?? null;
}
