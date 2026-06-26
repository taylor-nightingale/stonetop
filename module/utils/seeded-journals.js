// Shared lookups for the seeded world journals. The seeder assigns ids that
// aren't portable across worlds, so name is the stable handle the GM/players
// see — keep these name constants and the lookup in one place so every caller
// (auto-open, Setting Overview popup, Welcome guide) agrees.

export const SETTING_OVERVIEW_JOURNAL = "Setting Overview";

// Find a visible world journal by name, or null if it isn't seeded/visible yet.
export function findVisibleJournal(name) {
	return game.journal?.find(j => j.name === name && j.visible) ?? null;
}

// The seeded "Setting Overview" journal's visible, non-empty pages, in display
// order. Empty when the journal hasn't been seeded for this user.
export function settingOverviewPages() {
	const journal = findVisibleJournal(SETTING_OVERVIEW_JOURNAL);
	if (!journal) return [];
	return [...journal.pages]
		.filter(p => (p.text?.content ?? "").trim())
		.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
}
