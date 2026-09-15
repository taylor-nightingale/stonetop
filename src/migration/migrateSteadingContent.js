import { CONTENT_TEXT_KEYS } from "./migrateSteadingShape.js";

// Persists the 1.7.0 content shape: the three free-text boxes folded into the three lists beside
// them, and the boxes themselves dropped.
//
// migrateSteadingShape already did the fold — in memory, pre-validation, from whatever the record
// still holds — so `actor.system.content` IS the answer by the time this runs and the only job is to
// write it back and delete the keys it replaced. Foundry's schema cleaning strips an undeclared key
// from the in-memory source, so the database is the only place the old text still exists and the
// only place that can be asked about it; the same reasoning as migrateSteadingFolk.
//
// Unconditional, and cheap enough to be: the runner fires only when the world's stored version is
// older than the system's, and re-running writes the same lists back. The `-=` deletions are no-ops
// once they have landed.
export async function migrateSteadingContent(actor) {
	const content = actor.system.content ?? {};
	await actor.update(Object.fromEntries([
		...Object.entries(CONTENT_TEXT_KEYS).flatMap(([section, textKey]) => [
			[`system.content.${section}`, [...(content[section] ?? [])]],
			// A dot path ending in `-=`, not a `-=` key nested inside an object value: the deletion
			// has to be the last segment of the path for the update to remove the stored field.
			[`system.content.-=${textKey}`, null],
		]),
	]));
}
