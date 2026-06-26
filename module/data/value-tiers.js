// What each trade "Value" tier is roughly worth, per Stonetop Book I ("Gear: Terms
// & Value", p.541–543) — the same wording as the Setting Overview's "Relative Value"
// page. Values are tiers, NOT a linear scale: a single Value 2 item is worth about a
// dozen Value 1 items, and three Value 1 items don't add up to a Value 3. Used to give
// every "Value N" mention in the journals a hover tooltip (see value-tooltips.js).

// Full single-tier description — what a "Value N" item is generally worth.
export const VALUE_TIER_WORTH = {
	0: "a purse of copper coins, a single silver coin, a favor, a few days of unskilled labor, or a common mundane item",
	1: "a handful of silver coins, a season of unskilled (or a few days of skilled) labor, a unit of trade goods, or a bit of finery",
	2: "a purse of silver coins or a single gold coin, a Surplus, a year of unskilled (or a season of skilled) labor, a cartload of common trade goods, or an item of luxury or status",
	3: "a handful of gold coins, a year of skilled labor, a good trained horse or mule, or a precious item (a ruby ring, a gold torc, etc.)",
	4: "a purse of gold coins, a dozen or so good horses, or a “priceless” item (a huge flawless gemstone, a gold statuette, a bejeweled scepter, etc.)",
};

// Concise endpoint phrase per tier — used when tooltipping a range ("Value 0-2").
export const VALUE_TIER_SHORT = {
	0: "a few coppers, a favor, or a common item",
	1: "a handful of silvers or a unit of trade goods",
	2: "a gold coin, a Surplus, or a luxury item",
	3: "a handful of gold, a good horse, or a precious item",
	4: "a purse of gold, or a “priceless” treasure",
};

// Appended to every Value tooltip: the one genuinely non-obvious thing about
// Stonetop's wealth system — it's tiered, not additive.
const NONLINEAR_NOTE = "Trade Values are tiers, not linear: one Value 2 item ≈ a dozen Value 1 items.";

// The single-tier tooltip strings are static, so build them once up front — the
// common "Value N" case is then a lookup rather than a re-concatenation on every
// match on every render. Ranges and out-of-range tiers (both rare) stay dynamic.
const _SINGLE_TOOLTIP = Object.fromEntries(
	Object.entries(VALUE_TIER_WORTH).map(([tier, worth]) =>
		[tier, `Trade Value ${tier}: roughly worth ${worth}. ${NONLINEAR_NOTE}`]),
);

/**
 * The hover-tooltip text for a "Value N" (or "Value N-M" range) mention, or null if
 * the number isn't a usable tier. `b` is the high end of a range, if any.
 * @param {string|number} a
 * @param {string|number} [b]
 * @returns {string|null}
 */
export function valueTooltip(a, b) {
	const lo = Number(a);
	if (!Number.isInteger(lo) || lo < 0) return null;

	// A range, e.g. "Value 0-2": name both endpoints briefly.
	if (b !== undefined && b !== null && b !== "") {
		const hi = Number(b);
		const loS = VALUE_TIER_SHORT[lo] ?? "exceptional wealth";
		const hiS = VALUE_TIER_SHORT[hi] ?? "exceptional wealth";
		return `Trade Value ${lo}–${hi}: from ${loS} (Value ${lo}) up to ${hiS} (Value ${hi}). ${NONLINEAR_NOTE}`;
	}

	const single = _SINGLE_TOOLTIP[lo];
	if (single) return single;

	// "Value from 0 to 4 (or rarely higher)" — anything above the named tiers.
	return `Trade Value ${lo}: exceptional wealth, beyond the usual Value 0–4 tiers. ${NONLINEAR_NOTE}`;
}
