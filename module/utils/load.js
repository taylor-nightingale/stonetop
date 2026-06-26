// ── Load levels ──────────────────────────────────────────────────────────────
// Load weight caps (Book I p.87) and the bucketing that turns a count of marked ◇
// into a load tier. Shared by the character model (buildSnapshot), the inventory
// snapshot defaults, and the Outfit dialog so the thresholds can never drift.

// Maximum number of regular ◇ at each load level.
export const LOAD_LEVEL_LIMITS = { light: 3, normal: 6, heavy: 9 };

// Raise every cap by a flat bonus. A move can grant one via its `loadBonus` field
// (the Ranger's Pack Horse sets it to 1 → light 4, normal 7, heavy 10); bonuses
// from multiple moves just stack. Zero returns the base caps unchanged.
export function loadLimitsFor(loadBonus = 0) {
	const b = Number(loadBonus) || 0;
	if (b <= 0) return LOAD_LEVEL_LIMITS;
	return {
		light:  LOAD_LEVEL_LIMITS.light  + b,
		normal: LOAD_LEVEL_LIMITS.normal + b,
		heavy:  LOAD_LEVEL_LIMITS.heavy  + b,
	};
}

// Bucket a count of marked ◇ into a load level. Anything past the heavy cap is
// "overloaded" — still heavy, but now risking exhaustion/injury.
export function deriveLoadLevel(totalWeight, loadLimits = LOAD_LEVEL_LIMITS) {
	if (totalWeight <= 0)                 return null;
	if (totalWeight <= loadLimits.light)  return "light";
	if (totalWeight <= loadLimits.normal) return "normal";
	if (totalWeight <= loadLimits.heavy)  return "heavy";
	return "overloaded";
}
