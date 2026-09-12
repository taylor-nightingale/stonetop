import { EntryStatus, protectedMarkup } from "./reconcile.js";
import { AwaitingTranslator } from "./awaiting.js";

const truncate = (text, max = 60) => (text.length > max ? `${text.slice(0, max)}…` : text);

export function summarise(reconciliation) {
	const { lang, pack } = reconciliation;
	const translated   = reconciliation.countOf(EntryStatus.TRANSLATED);
	const untranslated = reconciliation.countOf(EntryStatus.UNTRANSLATED);
	const needsReview  = reconciliation.countOf(EntryStatus.NEEDS_REVIEW);
	const orphaned     = reconciliation.countOf(EntryStatus.ORPHANED);
	const brokenLinks  = reconciliation.countOf(EntryStatus.BROKEN_MARKUP);
	const total        = translated + untranslated + needsReview + brokenLinks;
	const percent      = total ? Math.round((translated / total) * 100) : 0;
	return `${lang}/${pack}: ${translated}/${total} translated (${percent}%)`
		+ `, ${untranslated} untranslated, ${needsReview} needing review, ${orphaned} orphaned`
		+ (brokenLinks ? `, ${brokenLinks} with broken markup` : "");
}

// An acknowledged entry still prints — it is in the translator's queue and saying so is the point —
// but it prints as waiting rather than as drift nobody has looked at.
const awaitingLine = (slug, entry) => [`  awaiting translator  ${slug} ${entry.key}`];

const needsReviewLines = (slug, entry) => [
	`  needs review  ${slug} ${entry.key}`,
	`                English is now: ${truncate(entry.source)}`,
];

const brokenMarkupLines = (slug, entry) => [
	`  broken markup ${slug} ${entry.key}`,
	`                @UUID targets and [[rolls]] must survive translation unchanged —`,
	`                rewrite the {label}, never the [target] or the dice`,
	`                expected: ${protectedMarkup(entry.source).join(", ") || "(none)"}`,
	`                found:    ${protectedMarkup(entry.text).join(", ") || "(none)"}`,
];

const orphanedLines = (slug, entry) => [
	`  orphaned      ${slug} ${entry.key} — no longer in the pack; move or delete it`,
];

const LINES_FOR = {
	[EntryStatus.NEEDS_REVIEW]:  needsReviewLines,
	[EntryStatus.BROKEN_MARKUP]: brokenMarkupLines,
	[EntryStatus.ORPHANED]:      orphanedLines,
};

export function detail(reconciliation, awaiting = AwaitingTranslator.empty()) {
	return reconciliation.flaggedEntries.flatMap(({ pack, slug, entry }) =>
		awaiting.has(pack, slug, entry.key)
			? awaitingLine(slug, entry)
			: LINES_FOR[entry.status](slug, entry));
}

export function staleLines(stale) {
	return stale.map(entry => `  resolved      ${entry.label} — translated now; remove it from _awaiting.json`);
}
