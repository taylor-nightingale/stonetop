// Steading moves are seeded once, at actor creation, so a steading made before a move joined the
// compendium never receives it — that's how the four Seasons Change moves would miss every existing
// world. Backfills them on the same terms as migrateReferenceMoveCategories does for characters:
// only categories the steading has NOTHING from, because a GM who deleted a single move meant it.
//
// The restamp runs first, and must: a steading seeded while Seasons Change still lived under the
// homefront moveType carries those four in the wrong category, so `seasons` would read as empty and
// seed a second copy of each.
export async function migrateSteadingMoves(actor) {
	const moves = actor.typedActor?.moves;
	if (!moves) return;
	await moves.restampCategories();
	await moves.seedMissingCategories();
}
