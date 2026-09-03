const SCOPE = "stonetop";

// One-time SEMANTIC migration for a legacy steading, run from the MigrationRunner on the
// initialized actor. Shape healing (old {current, items} ratings, root fortunes/surplus, string
// places, the residents fold) already happened in SteadingData.migrateData — see
// migrateSteadingShape — so by the time this runs the system data is in the current shape. This
// pass stamps what a legacy steading ADOPTS from the Stonetop steadfast: its provenance, the
// improvements the old repository used to surface to every steading, and the starting-attributes
// baseline for the "Starts at …" notes — and folds very old FLAG-based people / pick state into
// the system copy. `defaults` (improvements + attributes) comes from the Stonetop steadfast via
// the MigrationRunner. Idempotent: a steading that already has a steadfast set is left alone.
export async function migrateSteading(actor, defaults = {}) {
	if (actor.system?.steadfast) return;
	const { improvements = [], attributes: startingAttributes = {} } = defaults;
	const sys = actor.system ?? {};

	// Flag-era people land in the ONE roster the system now keeps — writing the retired
	// residentPeople/neighborPeople keys would be dropped by schema cleaning and lose them outright.
	// `sys.folk` is what migrateSteadingShape already folded out of those keys on load.
	const flagged   = [
		...(actor.getFlag(SCOPE, "steading.residents") ?? []),
		...(actor.getFlag(SCOPE, "steading.neighborPeople") ?? []),
	].map(person => ({ home: "", ...person }));
	const people    = flagged.length ? flagged : (sys.folk ?? []);
	const picks     = actor.getFlag(SCOPE, "improvements.pickValues") ?? sys.improvementValues ?? {};

	await actor.update({
		"system.steadfast": "stonetop",
		"system.startingAttributes": { ...startingAttributes },
		"system.folk": people,
		"system.improvements": [...improvements],
		"system.improvementValues": picks,
	});
}
