// Helpers for stepping/comparing polyhedral damage dice (d4 → d12).
export const DIE_ORDER = ["d4", "d6", "d8", "d10", "d12"];

/** Increase `die` by `steps` sizes, capped at `cap`. Unknown dice pass through. */
export function stepDie(die, steps, cap = "d12") {
	const i = DIE_ORDER.indexOf(die);
	if (i < 0) return die;
	const capIdx = DIE_ORDER.indexOf(cap);
	const max = capIdx < 0 ? DIE_ORDER.length - 1 : capIdx;
	return DIE_ORDER[Math.max(0, Math.min(i + steps, max))];
}

/** Return the larger of two dice. Unknown dice defer to the other. */
export function maxDie(a, b) {
	const ia = DIE_ORDER.indexOf(a);
	const ib = DIE_ORDER.indexOf(b);
	if (ia < 0) return b ?? a;
	if (ib < 0) return a;
	return DIE_ORDER[Math.max(ia, ib)];
}
