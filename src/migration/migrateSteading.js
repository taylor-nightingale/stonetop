import { SteadingDefaults } from "../model/data/steading/SteadingDefaults.js";

const SCOPE = "stonetop";

// Convert a legacy steading to the Stage-C shape: ratings become their actual values (were indices),
// size becomes its tier string, the resource/fortification lists move under assets, places become
// objects, the resident pool folds into `residents:{names,traits}` while the people move to
// `residentPeople`, and improvements become an owned slug list + `improvementValues` pick state.
// `defaults` carries what a migrated (Stonetop) steading should adopt from its steadfast: the granted
// `improvements` list (what the old repo surfaced to every steading) and the steadfast's starting
// `attributes` (kept as the immutable `startingAttributes` baseline for the "Starts at …" notes).
// Supplied by the MigrationRunner. Idempotent: a steading that already has a steadfast set is left
// alone. Runs once from the MigrationRunner (full document), never from model.migrateData.
export async function migrateSteading(actor, defaults = {}) {
	if (actor.system?.steadfast) return;
	const { improvements = [], attributes: startingAttributes = {} } = defaults;

	const sys  = actor.system ?? {};
	const attr = sys.attributes ?? {};

	const rating = (slug, current) => {
		const bonuses = SteadingDefaults.attributes[slug]?.bonuses ?? [];
		return bonuses[current ?? 1] ?? 0;
	};
	const sizeTier    = SteadingDefaults.attributes.size.values[attr.size?.current ?? 1] ?? "village";
	const fortunesVal = SteadingDefaults.fortunes.bonuses[sys.fortunes ?? SteadingDefaults.fortunes.current] ?? 0;

	// People / pick state may still live in flags on very old steadings; otherwise read the system copy.
	const people   = actor.getFlag(SCOPE, "steading.residents")      ?? (Array.isArray(sys.residents) ? sys.residents : []);
	const neighbors= actor.getFlag(SCOPE, "steading.neighborPeople") ?? sys.neighborPeople ?? [];
	const picks    = actor.getFlag(SCOPE, "improvements.pickValues") ?? sys.improvements?.pickValues ?? {};

	await actor.update({
		"system.steadfast": "stonetop",
		"system.attributes": {
			fortunes:   fortunesVal,
			surplus:    sys.surplus ?? SteadingDefaults.surplus.current,
			size:       sizeTier,
			population: rating("population", attr.population?.current),
			prosperity: rating("prosperity", attr.prosperity?.current),
			defenses:   rating("defenses",   attr.defenses?.current),
		},
		"system.assets": {
			items:          sys.assets?.items ?? [],
			resources:      attr.prosperity?.items ?? [],
			fortifications: attr.defenses?.items ?? [],
			coinage:        sys.assets?.coinage ?? [],
		},
		"system.placesOfInterest": (sys.placesOfInterest ?? []).map(p =>
			typeof p === "string" ? { name: p, journalReference: "" } : p),
		"system.startingAttributes": { ...startingAttributes },
		"system.residents":     { names: sys.residentNames ?? "", traits: sys.residentTraits ?? [] },
		"system.residentPeople": people,
		"system.neighborPeople": neighbors,
		"system.improvements":      [...improvements],
		"system.improvementValues": picks,
	});
}
