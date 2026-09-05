/**
 * One entry in a reference list the Folk tab keeps whole — a name off a region's list, or a trait off
 * the NPC-traits pool.
 *
 * `used` dims it rather than removing it: repeating a trait is sometimes exactly right, and you still
 * want to see at a glance that "cheery" is already taken by two people. `clickable` is false for a
 * token that is not a usable value (see NamePool) — it still shows, as plain text.
 */
export class Suggestion {
	constructor(label, used = false, clickable = true) {
		this.label = label;
		this.used = used;
		this.clickable = clickable;
	}
}

/**
 * One titled block of the Folk tab's reference column: "Names — Stonetop", "Names — Marshedge",
 * "Traits".
 *
 * `kind` is what the entries DO when clicked — a name replaces the focused row's name, a trait
 * appends to its traits — so the one partial that renders a list emits the right action without
 * knowing anything else about which list it was handed.
 *
 * `home` is where this list's names come FROM, which a name carries with it: picking one off
 * Marshedge's list is the table saying this person is from Marshedge, and a Home column that then
 * has to be typed out by hand is asking for a fact already given. Blank on the steading's own list
 * and on the traits — a blank home IS this steading — and a trait belongs to nowhere.
 *
 * `key` identifies the block to anything outside its own DOM (the collapse state one reader keeps),
 * so it has to be stable across renders and unique on the tab.
 *
 * `open` is how the block ARRIVES, before the reader has said anything about it. Which lists those
 * are is the caller's knowledge, not this class's — see FolkSuggestions — and a reader's own folds
 * outlive it either way (OpenDisclosures).
 */
export class SuggestionList {
	static NAME  = "name";
	static TRAIT = "trait";

	constructor(title, kind, entries, { key = "", home = "", open = true } = {}) {
		this.title = title;
		this.kind = kind;
		this.entries = entries;
		this.key = key;
		this.home = home;
		this.open = open;
		this.action = kind === SuggestionList.TRAIT ? "useTrait" : "useName";
	}

	get isEmpty() {
		return this.entries.length === 0;
	}
}
