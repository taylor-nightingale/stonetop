import { Disclosure } from "./Disclosure.js";

/**
 * Open the named sections of a tab (`[data-section="<key>"]`) and remember that they are open — what
 * a route does where it lands: the masthead's instinct opens the instinct, the level-up review opens
 * it and appearance. Brings the first into view. Returns the sections it opened.
 *
 * @param {Element} root the sheet
 * @param {string[]} keys section keys
 * @param {OpenDisclosures} memory the sheet's
 */
export function openSections(root, keys, memory) {
	const opened = [];
	for (const key of keys) {
		const section = root.querySelector(`[data-section="${key}"]`);
		// The section's own toggles — its door, and a Moves panel's caret — not the rows inside it.
		const own = [...(section?.querySelectorAll(Disclosure.TOGGLE) ?? [])]
			.filter(toggle => toggle.closest(Disclosure.ROW) === section)
			.map(toggle => Disclosure.from(toggle)).filter(Boolean);
		if (!own.length) continue;
		for (const disclosure of own) {
			disclosure.setOpen(true);
			memory?.remember(disclosure);
		}
		opened.push(section);
	}
	opened[0]?.scrollIntoView?.({ block: "nearest" });
	return opened;
}
