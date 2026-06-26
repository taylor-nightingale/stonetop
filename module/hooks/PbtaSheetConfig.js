import { error } from "../utils/logger.js";

// Runs once on ready. Handles data migrations that were previously
// done via the pbtaSheetConfig hook when this was a module on PBTA.
export async function runStartupMigrations() {
	if (!game.user.isGM) return;
	await _ensureAllCharacterMoves().catch(error);
}

async function _ensureAllCharacterMoves() {
	for (const actor of game.actors) {
		if (actor.type !== "character") continue;
		await actor.typedActor?.ensureStartingMoves?.();
	}
}
