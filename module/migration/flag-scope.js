// Pure helper for the "fork-self" migration path (Path A): when the system id changes
// (stonetop_pwd → stonetop), an existing fork world's actor data still lives under the OLD
// flag scope. This deep-merges the legacy-scope flags into the active scope so all of a
// document's flags live under one scope (avoiding the split-scope ambiguity in
// resolvedFlags(), which only ever returns ONE scope's object).
//
// `to`-scope values win, so anything already written under the new scope is never clobbered.
// Non-destructive: the caller leaves the legacy scope in place (harmless once consolidated).

function deepMerge(base, over) {
	const out = { ...base };
	for (const [k, v] of Object.entries(over ?? {})) {
		const isPlain = x => x && typeof x === "object" && !Array.isArray(x);
		out[k] = (isPlain(v) && isPlain(out[k])) ? deepMerge(out[k], v) : v;
	}
	return out;
}

/**
 * Build an actor/document `.update()` payload that consolidates `fromScope` flags into
 * `toScope`, or null when there's nothing to move.
 * @param {object} flags      The document's `flags` object.
 * @param {string} fromScope  Legacy scope (e.g. "stonetop_pwd").
 * @param {string} toScope    Active scope (e.g. "stonetop").
 * @returns {object|null}
 */
export function buildFlagScopeConsolidation(flags, fromScope, toScope) {
	if (fromScope === toScope) return null;
	const from = flags?.[fromScope];
	if (!from || typeof from !== "object" || !Object.keys(from).length) return null;
	const to = (flags?.[toScope] && typeof flags[toScope] === "object") ? flags[toScope] : {};
	return { [`flags.${toScope}`]: deepMerge(from, to) };
}
