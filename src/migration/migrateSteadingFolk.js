// Writes the 1.6.0 steading shape back to the database: residents and neighbours merged into one
// `folk` roster, and general assets carrying their requisitioned state.
//
// migrateSteadingShape already produced both — in memory, pre-validation, from whatever the record
// still holds — so by the time this runs `actor.system` IS the answer and the only job is to persist
// it and drop the two keys it replaced. Foundry's schema cleaning strips an undeclared key from the
// in-memory source, so the database is the only place the legacy keys still exist and the only place
// that can be asked about them; rather than guess, this simply writes what it knows to be right.
//
// Unconditional, and cheap enough to be: the runner itself only fires when the world's stored version
// is older than the system's (see hooks/Ready.js), so this is one update per steading per upgrade,
// and re-running it writes the same values back. The `-=` deletions are no-ops once they have landed.
//
// Deliberately not folded into migrateSteading: that one returns early for any steading that already
// has a steadfast — which is every steading created since 0.13.0, i.e. exactly the ones with a
// neighbour roster worth keeping.
export async function migrateSteadingFolk(actor) {
	await actor.update({
		"system.folk": actor.system.folk ?? [],
		"system.assets.items": (actor.system.assets?.items ?? []).map(item => ({...item})),
		"system.-=residentPeople": null,
		"system.-=neighborPeople": null,
	});
}
