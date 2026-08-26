import { EntryStatus } from "./reconcile.js";

const truncate = (text, max = 60) => (text.length > max ? `${text.slice(0, max)}…` : text);

export function summarise(reconciliation) {
	const { lang, pack } = reconciliation;
	const translated   = reconciliation.countOf(EntryStatus.TRANSLATED);
	const untranslated = reconciliation.countOf(EntryStatus.UNTRANSLATED);
	const needsReview  = reconciliation.countOf(EntryStatus.NEEDS_REVIEW);
	const orphaned     = reconciliation.countOf(EntryStatus.ORPHANED);
	const total        = translated + untranslated + needsReview;
	const percent      = total ? Math.round((translated / total) * 100) : 0;
	return `${lang}/${pack}: ${translated}/${total} translated (${percent}%)`
		+ `, ${untranslated} untranslated, ${needsReview} needing review, ${orphaned} orphaned`;
}

export function detail(reconciliation) {
	const lines = [];
	for (const { slug, entry } of reconciliation.entriesWith(EntryStatus.NEEDS_REVIEW)) {
		lines.push(`  needs review  ${slug} ${entry.key}`);
		lines.push(`                English is now: ${truncate(entry.source)}`);
	}
	for (const { slug, entry } of reconciliation.entriesWith(EntryStatus.ORPHANED)) {
		lines.push(`  orphaned      ${slug} ${entry.key} — no longer in the pack; move or delete it`);
	}
	return lines;
}
