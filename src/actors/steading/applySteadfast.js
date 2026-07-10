// Apply a steadfast's definition to a steading actor: copy the shared profile fields onto the actor
// (independent copies it then edits in play — the character/playbook pattern, where the actor's live
// state lives on the actor, seeded from the definition) and record which steadfast it came from. The
// actor's runtime state (residentPeople, neighborPeople, debilities, content, improvementValues) is
// left untouched.
const PROFILE_FIELDS = ["attributes", "assets", "placesOfInterest", "neighborPlaces", "residents", "improvements"];

export async function applySteadfast(actor, steadfast) {
	const src = steadfast.system;
	const update = { "system.steadfast": src.slug, name: steadfast.name };
	for (const field of PROFILE_FIELDS) update[`system.${field}`] = structuredClone(src[field]);
	// The steadfast's attributes are its starting values; keep an immutable copy so the "Starts at …"
	// notes stay correct after the live `attributes` are edited in play.
	update["system.startingAttributes"] = structuredClone(src.attributes);
	await actor.update(update);
}

// Find the steadfast whose name matches `name` (trimmed, case-insensitive), or null. Lets the steading
// sheet's name combobox tell "picked/typed an existing steadfast" (→ apply it) from "typed a custom
// steading name" (→ just rename). `steadfasts` is the {slug, name} list from loadAllSteadfasts.
export function matchSteadfastByName(name, steadfasts) {
	const key = (name ?? "").trim().toLowerCase();
	if (!key) return null;
	return steadfasts.find(s => (s.name ?? "").trim().toLowerCase() === key) ?? null;
}

// Load a steadfast item from the steadfasts compendium by slug (null if the pack/item is absent).
// Used to seed new steadings (create hook) and to re-apply when the sheet's steadfast dropdown changes.
export async function loadSteadfast(slug) {
	const pack = game.packs?.get("stonetop.steadfasts");
	if (!pack) return null;
	const docs = await pack.getDocuments();
	return docs.find(d => d.system?.slug === slug) ?? null;
}

// The {slug, name} of every steadfast, for the steading sheet's steadfast picker. Ordered by
// sortOrder (Stonetop is 0) then name. Empty when the pack is absent.
export async function loadAllSteadfasts() {
	const pack = game.packs?.get("stonetop.steadfasts");
	if (!pack) return [];
	const docs = await pack.getDocuments();
	return docs
		.filter(d => d.system?.slug)
		.map(d => ({ slug: d.system.slug, name: d.name, sortOrder: d.system.sortOrder ?? 0 }))
		.sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name))
		.map(({ slug, name }) => ({ slug, name }));
}
