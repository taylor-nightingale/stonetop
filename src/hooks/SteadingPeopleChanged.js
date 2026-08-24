import { SteadingPeopleDelta } from "../actors/steading/SteadingPeopleDelta.js";

/** Where the delta rides from the editing client to everyone else's update hook. */
export const PEOPLE_DELTA_KEY = "stonetopPeopleDelta";

/**
 * Residents and neighbours get NPC actors so a relationship map has something to point at. Creating
 * actors and folders is privileged — actor creation defaults to the Assistant GM role and folder
 * creation cannot be granted to players at all — but the people filling in the roster are usually
 * players. So the work is split: the editing client works out WHAT changed, and the active GM's
 * client, which sees the same update, does it.
 */

// preUpdate runs only on the editing client, and only there does the pre-edit document still exist —
// the diff alone can't say which of twenty rewritten rows actually changed. Custom keys on `options`
// travel with the update to every client.
export function onPreUpdateSteadingPeople(actor, changed, options) {
	if (actor.type !== "steading") return;
	const delta = SteadingPeopleDelta.between(actor.system, changed);
	if (!delta.isEmpty) options[PEOPLE_DELTA_KEY] = delta.toRaw();
}

export async function onUpdateSteadingPeople(actor, changed, options) {
	if (actor.type !== "steading") return;
	const raw = options?.[PEOPLE_DELTA_KEY];
	if (!raw) return;
	// One GM does the work, however many are connected.
	if (!game.users?.activeGM || game.users.activeGM !== game.user) return;
	if (!autoCreateEnabled()) return;
	await actor.typedActor?.syncLinkedActors(SteadingPeopleDelta.fromRaw(raw));
}

function autoCreateEnabled() {
	try {
		return game.settings.get("stonetop", "autoCreateResidentActors") !== false;
	} catch {
		return false;
	}
}
