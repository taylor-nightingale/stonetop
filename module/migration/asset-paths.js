// Pure helpers for the "fork-self" migration path (Path A): after the system id changes
// (stonetop_pwd → stonetop), a fork world's DOCUMENTS still carry absolute asset paths that
// were saved under the old id — actor portraits/tokens (`systems/stonetop_pwd/assets/…`),
// baked-in chat-card icons, etc. The renamed system serves those assets from
// `systems/stonetop/…`, so the old paths 404. Flag/settings consolidation (flag-scope.js)
// does NOT touch these, so Path A also runs this remap.
//
// These functions are pure (no Foundry): the runner walks each document's source through
// `remapAssetStrings` and applies `buildOwnFieldRemap` via `doc.update()`, recursing into
// embedded collections (items, pages, scene tokens, …) so nested paths are caught too.

/**
 * Recursively rewrite every string under `value` that contains `needle`, replacing each
 * occurrence with `replacement`. Returns the (possibly new) value plus whether anything
 * changed. Non-mutating: objects/arrays are cloned only on the changed branch.
 * @returns {{value: any, changed: boolean}}
 */
export function remapAssetStrings(value, needle, replacement) {
	if (typeof value === "string") {
		if (!value.includes(needle)) return { value, changed: false };
		return { value: value.split(needle).join(replacement), changed: true };
	}
	if (Array.isArray(value)) {
		let changed = false;
		const out = value.map(v => {
			const r = remapAssetStrings(v, needle, replacement);
			changed ||= r.changed;
			return r.value;
		});
		return changed ? { value: out, changed } : { value, changed: false };
	}
	if (value && typeof value === "object") {
		let changed = false;
		const out = {};
		for (const [k, v] of Object.entries(value)) {
			const r = remapAssetStrings(v, needle, replacement);
			changed ||= r.changed;
			out[k] = r.value;
		}
		return changed ? { value: out, changed } : { value, changed: false };
	}
	return { value, changed: false };
}

/**
 * Build a document `.update()` payload that remaps `systems/<from>/` → `systems/<to>/` across
 * the document's OWN fields, excluding embedded-collection fields (the caller recurses into
 * those separately, since embedded docs can't be set through a parent update). Top-level keys
 * that changed are returned whole (so an array field is replaced atomically, as Foundry expects).
 * @param {object} source         The document's source object (`doc.toObject()`).
 * @param {string} from           Legacy system id (e.g. "stonetop_pwd").
 * @param {string} to             Active system id (e.g. "stonetop").
 * @param {string[]} embeddedKeys Field names of embedded collections to skip (e.g. ["items","effects"]).
 * @returns {object} update payload — empty when nothing needs remapping.
 */
export function buildOwnFieldRemap(source, from, to, embeddedKeys = []) {
	if (from === to || !source || typeof source !== "object") return {};
	const needle = `systems/${from}/`;
	const replacement = `systems/${to}/`;
	const skip = new Set(embeddedKeys);
	const update = {};
	for (const [k, v] of Object.entries(source)) {
		if (skip.has(k)) continue;
		const r = remapAssetStrings(v, needle, replacement);
		if (r.changed) update[k] = r.value;
	}
	return update;
}
