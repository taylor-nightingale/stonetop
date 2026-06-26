import { ledgerNoun, ledgerNounCounts } from "../actors/character/CharacterLedger.js";
import { escHtml } from "./strings.js";

/**
 * Shared toolbar wiring for the character and steading ledger dialogs, which are
 * otherwise identical. Keeps the "filter by subject" dropdown and live text
 * search in one place so the two dialogs can't drift apart.
 */

/** Build the `<option>` list for the ledger "filter by subject" dropdown. */
export function ledgerNounOptionsHtml(entries) {
	return ledgerNounCounts(entries)
		.map(({ noun, count }) => `<option value="${escHtml(noun)}">${escHtml(noun)} (${count})</option>`)
		.join("");
}

/**
 * Wire the toolbar's text search + subject dropdown to show/hide entries. Caches
 * each entry's lowercased text and derived noun once (and the entry list itself),
 * so neither keystroke re-derives nor re-queries the DOM. Runs `afterFilter` —
 * e.g. to resync date headers and the select-all checkbox — after each change.
 */
export function wireLedgerFilters(html, afterFilter) {
	const entries = html.find(".stonetop-ledger-entry");
	entries.each((_, el) => {
		const actionText = el.querySelector(".stonetop-ledger-entry-main")?.textContent ?? "";
		el._ledgerText = actionText.toLowerCase();
		el._ledgerNoun = ledgerNoun(actionText);
	});

	const searchEl = html.find(".stonetop-ledger-search")[0];
	const nounEl   = html.find(".stonetop-ledger-noun")[0];
	const applyFilter = () => {
		const term = (searchEl?.value ?? "").trim().toLowerCase();
		const noun = nounEl?.value ?? "";
		entries.each((_, el) => {
			const matchesText = !term || el._ledgerText.includes(term);
			const matchesNoun = !noun || el._ledgerNoun === noun;
			el.hidden = !(matchesText && matchesNoun);
		});
		afterFilter?.();
	};

	html.find(".stonetop-ledger-search").on("input", applyFilter);
	html.find(".stonetop-ledger-noun").on("change", applyFilter);
}
