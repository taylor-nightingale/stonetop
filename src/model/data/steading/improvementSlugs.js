// Pure operations on an improvement slug list — a steadfast's granted improvements or a steading's
// owned ones. Kept Foundry-free so the sheets' drag/drop and remove handlers stay a thin shell over
// logic that can be unit tested directly.

/** Append `slug` unless it's blank or already there (drops are idempotent). Returns a new array. */
export const addImprovement = (improvements, slug) =>
	(!slug || improvements.includes(slug)) ? [...improvements] : [...improvements, slug];

/** Drop `slug` from the list. Returns a new array. */
export const removeImprovement = (improvements, slug) =>
	improvements.filter((s) => s !== slug);
