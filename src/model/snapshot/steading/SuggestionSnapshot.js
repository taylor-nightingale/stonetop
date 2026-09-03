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
 */
export class SuggestionList {
	static NAME  = "name";
	static TRAIT = "trait";

	constructor(title, kind, entries) {
		this.title = title;
		this.kind = kind;
		this.entries = entries;
		this.action = kind === SuggestionList.TRAIT ? "useTrait" : "useName";
	}

	get isEmpty() {
		return this.entries.length === 0;
	}
}
