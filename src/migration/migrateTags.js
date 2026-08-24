import { Selection } from "../model/data/Selection.js";

/** The legacy Selection blob: the value smuggled options and picker config alongside the tokens. */
const isSelectionBlob = (value) =>
	value !== null && typeof value === "object" && !Array.isArray(value) && Array.isArray(value.selected);

const tokens = (list) => list.map((t) => String(t).trim()).filter(Boolean);

/**
 * Normalize one stored tag value — a legacy comma string, a legacy Selection blob, or the token
 * array it should have been — into the stored shape: an ordered list of tokens.
 *
 * Returns `undefined` when there is nothing to do, so callers never default-inject a value that was
 * absent: Foundry re-runs migrateData on the partial {changed-keys} update diff, and injecting there
 * clobbers stored values on every edit.
 */
export function toStoredTags(value) {
	if (value === undefined || value === null) return undefined;
	if (Array.isArray(value)) {
		const clean = tokens(value);
		return clean.length === value.length ? undefined : clean;
	}
	if (isSelectionBlob(value)) return tokens(value.selected);
	return Selection.fromStored(value, { multi: true }).values;
}

/**
 * The options a legacy Selection blob carried, which are authored data on a stat block that prints
 * its own choices — they move to the sibling `tagOptions` rather than staying inside the value.
 * `undefined` when there were none to lift.
 */
export function toStoredTagOptions(value) {
	if (!isSelectionBlob(value) || !Array.isArray(value.options) || !value.options.length) return undefined;
	return tokens(value.options);
}

/**
 * Convert `holder`'s tags in place, folding a legacy `tags` key onto `tagList` and lifting any
 * options the old blob carried into `tagOptions`.
 *
 * `tagList`, never `tags`: Foundry reserves the item field `system.tags` and wipes it on every
 * update. Nested `tags` (inside an ObjectField) survives, which is why the old data has both — but
 * one name everywhere is the point of the conversion.
 *
 * @returns {boolean} whether anything changed — callers building an update diff need to know.
 */
export function migrateTagsOn(holder) {
	if (!holder || typeof holder !== "object") return false;

	const hasLegacyKey = "tags" in holder;
	// A holder carrying both keeps `tagList` — the canonical name wins over the one being retired.
	const source = holder.tagList !== undefined ? holder.tagList : holder.tags;

	const converted = toStoredTags(source);
	if (converted !== undefined) holder.tagList = converted;

	// Only where the field exists to receive them: gear has no `tagOptions`, and a stat block's
	// printed choices are the only options anyone ever authored.
	const options = toStoredTagOptions(source);
	if (options !== undefined && !holder.tagOptions?.length) holder.tagOptions = options;

	if (hasLegacyKey) delete holder.tags;
	return hasLegacyKey || converted !== undefined || options !== undefined;
}

/**
 * Convert the tags on every embedded outfit-item definition anywhere under `node`.
 *
 * Embedded gear hides at several depths — a possession's `outfitItems`, and the same array inside a
 * choice group's options — so this finds them by key rather than by hard-coding each path, which
 * would silently miss a new one.
 *
 * @returns {boolean} whether anything changed.
 */
export function migrateEmbeddedOutfitTags(node) {
	let changed = false;
	const visit = (value) => {
		if (Array.isArray(value)) return value.forEach(visit);
		if (!value || typeof value !== "object") return;
		if (Array.isArray(value.outfitItems)) {
			for (const item of value.outfitItems) changed = migrateTagsOn(item) || changed;
		}
		for (const child of Object.values(value)) visit(child);
	};
	visit(node);
	return changed;
}
