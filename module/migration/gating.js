// Pure gating for the fork-self Path A migration passes. Each pass must be applied EXACTLY ONCE —
// at the SCHEMA_VERSION that introduced it — not every time the world's stored `dataVersion` is below
// the latest SCHEMA_VERSION.
//
// This is load-bearing: pass A1 (legacy flag-scope consolidation) is NON-DESTRUCTIVE — it leaves the
// old `flags.stonetop_pwd` scope in place — so re-running it on a later bump would deep-merge that
// stale scope back over the active one and resurrect any flag a GM has since deleted under the new
// scope. So a pass keyed to version N runs only while `current < N`. Gate every NEW pass here.
//
// @param {number} current  The world's stored `dataVersion` (0 when never migrated).
// @returns {{consolidate: boolean, remapAssets: boolean}}
export function pathAPassesFor(current) {
	const v = Number(current) || 0;
	return {
		consolidate: v < 1, // v1 — A1 legacy flag-scope + A2 legacy settings consolidation
		remapAssets: v < 2, // v2 — A3 world-document asset-path remap (systems/stonetop_pwd → systems/stonetop)
	};
}
