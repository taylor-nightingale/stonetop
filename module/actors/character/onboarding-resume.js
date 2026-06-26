// ── Onboarding resume snapshot ───────────────────────────────────────────────
// A character's in-progress creation answers, stored client-side so an unexpected
// reload (e.g. a dropped connection) doesn't lose written content. localStorage is
// deliberate: this only needs to survive a reload on the same machine, and writing
// it costs nothing — no database round-trip and no broadcast to other clients, the
// way an actor flag would on every keystroke. It even works while offline, which is
// the failure case it exists for. The lightweight page number (for the GM's roster)
// still lives in the actor's onboardingProgress flag; only the heavy selections blob
// lives here.
//
// Trade-off: being client-local, this won't follow a player to a different browser
// or computer — there, creation falls back to restarting the current page.

const PREFIX = "stonetop.onboarding";

function storageKey(actor) {
	return `${PREFIX}.${game?.world?.id ?? "world"}.${actor.id}`;
}

// Persist the resume snapshot. Swallows storage errors (private mode / quota) — a
// failed autosave must never interrupt the player.
export function writeOnboardingResume(actor, snapshot) {
	if (!actor?.id) return;
	try {
		localStorage.setItem(storageKey(actor), JSON.stringify(snapshot));
	} catch (_err) { /* storage unavailable — resume just won't be offered */ }
}

// Read the resume snapshot, or null if there's nothing saved / it can't be parsed.
export function readOnboardingResume(actor) {
	if (!actor?.id) return null;
	try {
		const raw = localStorage.getItem(storageKey(actor));
		return raw ? JSON.parse(raw) : null;
	} catch (_err) {
		return null;
	}
}

// Drop the snapshot once creation is finished.
export function clearOnboardingResume(actor) {
	if (!actor?.id) return;
	try {
		localStorage.removeItem(storageKey(actor));
	} catch (_err) { /* nothing to clean up */ }
}
