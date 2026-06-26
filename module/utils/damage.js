/**
 * Canonical Stonetop damage-die grammar — a die expression like `d8`, `2d6`,
 * `d10+2`, or `d8 - 1` (whitespace around the modifier is tolerated, matching how
 * the transcribed stat blocks print it). Shared by the character Followers tab
 * (_parseFollowerDamage) and the monster stat-block parser so the two recognise
 * exactly the same grammar instead of drifting apart.
 *
 * Stateless (no `g` flag), so it is safe to reuse the single instance across
 * `.test()` / `.match()` calls.
 */
export const DAMAGE_DIE_RE = /\d*d\d+(?:\s*[+-]\s*\d+)?/i;

/** The first die expression in a free-text damage string, or null. */
export function dieFromDamage(str) {
	return String(str ?? "").match(DAMAGE_DIE_RE)?.[0] ?? null;
}
