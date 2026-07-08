// Pure operations on a steadfast's granted-improvement slug list. Kept Foundry-free so the sheet's
// drag/drop and remove handlers stay a thin shell over logic that can be unit tested directly.

/** Append `slug` unless it's blank or already granted (drops are idempotent). Returns a new array. */
export const addImprovement = (improvements, slug) =>
	(!slug || improvements.includes(slug)) ? [...improvements] : [...improvements, slug];

/** Drop `slug` from the granted list. Returns a new array. */
export const removeImprovement = (improvements, slug) =>
	improvements.filter((s) => s !== slug);
