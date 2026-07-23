// Turns raw store index entries (compendium and/or world) into the lightweight { slug, name }
// summaries the authoring pickers list. Deduplicates by slug (first entry wins, so callers put the
// preferred source first) and drops slug-less entries. Sorted by name for a stable dropdown.
// Shared by the reference repositories (follower / insert / possession) so their `listSummaries`
// can't drift.
export function summarizeEntries(entries) {
	const bySlug = new Map();
	for (const entry of entries ?? []) {
		const slug = entry?.system?.slug;
		if (!slug || bySlug.has(slug)) continue;
		bySlug.set(slug, { slug, name: entry.name ?? slug });
	}
	return [...bySlug.values()].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
}
