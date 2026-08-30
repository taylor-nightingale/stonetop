/**
 * The keyboard model a tablist is supposed to have.
 *
 * Core renders the tab buttons and handles clicks, but ships no arrow-key navigation and no roving
 * tabindex — so a keyboard user tabs through every tab button one at a time, and a screen reader is
 * never told the row is a tablist at all. The ARIA half of that lives in the template; this is the
 * behaviour half.
 *
 * Activation is automatic (moving focus switches tab), which is the recommended pattern when showing
 * a panel is cheap — here it is a class toggle.
 *
 * Delegated from a root that outlives re-renders, so it is wired once.
 */
const STEP = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

export function activateTablistKeys(root) {
	root.addEventListener("keydown", ev => {
		const tab = ev.target?.closest?.('[role="tab"]');
		if (!tab) return;

		const tabs = [...(tab.closest('[role="tablist"]')?.querySelectorAll('[role="tab"]') ?? [])];
		if (tabs.length < 2) return;

		const next = nextTab(tabs, tabs.indexOf(tab), ev.key);
		if (!next || next === tab) return;

		ev.preventDefault();
		next.focus();
		next.click();
	});
}

function nextTab(tabs, index, key) {
	if (key in STEP) return tabs[(index + STEP[key] + tabs.length) % tabs.length];
	if (key === "Home") return tabs[0];
	if (key === "End")  return tabs.at(-1);
	return null;
}
