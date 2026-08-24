import { Selection } from "./Selection.js";
import { TagGlossary } from "./TagGlossary.js";

/** One tag ready to render: the token as authored, plus its book definition when there is one. */
export class ResolvedTag {
	constructor(label, slug, definition, category) {
		this.label      = label;
		this.slug       = slug;
		this.definition = definition;
		this.category   = category;
	}

	static of(label, glossary) {
		const known = glossary.lookup(label);
		return known
			? new ResolvedTag(label, known.slug, known.definition, known.category)
			: new ResolvedTag(label, null, null, null);
	}

	get hasDefinition() {
		return this.definition !== null;
	}
}

/**
 * A list of tags — on gear, on a creature, on one member of a group. Book I treats these as one
 * concept ("Members of a group have the same tags"; the same `magical` sits on a spear and on an
 * NPC), so they are one model: a `Selection` of tokens, stored the same way everywhere.
 *
 * Stored as the token list and nothing else: `multi` and `allowCustom` are constants of the field,
 * and options belong to the CONTEXT, not the value — the book's glossary for gear, the sibling
 * `tagOptions` for a creature that prints its own choices, `memberSuggestions` for a group member.
 * A `Selection` is still what the chip picker speaks, so `picker` builds one on demand; it is never
 * what gets saved.
 */
export class Tags {
	/**
	 * @param {Selection} selection stored value — selected tokens, plus any options the document itself carries
	 * @param {TagGlossary} glossary definitions to resolve against
	 * @param {string[]} suggestions context-supplied options, never stored
	 */
	constructor(selection, glossary = TagGlossary.current, suggestions = []) {
		this.selection   = selection;
		this.glossary    = glossary;
		this.suggestions = suggestions;
	}

	/** Idempotent, like `rich()`: an existing Tags passes through, so callers never double-wrap. */
	static fromStored(raw, { glossary = TagGlossary.current, suggestions = [] } = {}) {
		if (raw instanceof Tags) return raw;
		return new Tags(Selection.fromStored(raw, { multi: true }), glossary, suggestions);
	}

	/** Tags on an item, arcanum or possession — the book's glossary is the suggestion list. */
	static gear(raw, glossary = TagGlossary.current) {
		return Tags.fromStored(raw, { glossary, suggestions: glossary.labels });
	}

	/** Tags on an NPC or follower — `tagOptions` holds the choices the stat block prints for itself. */
	static creature(raw, options = [], glossary = TagGlossary.current) {
		return Tags.fromStored(raw, { glossary, suggestions: options });
	}

	/** Tags on one member of a group follower — the follower's suggestion pool is the option list. */
	static member(raw, suggestions = [], glossary = TagGlossary.current) {
		return Tags.fromStored(raw, { glossary, suggestions });
	}

	get values()  { return this.selection.values; }
	get text()    { return this.selection.text; }
	get isEmpty() { return this.selection.isEmpty; }

	has(tag) { return this.selection.has(tag); }

	/** The selected tags, in authored order, each with its definition when the glossary has one. */
	get resolved() {
		return this.values.map((v) => ResolvedTag.of(v, this.glossary));
	}

	/** Only the tags the book defines — what a tooltip or a legend can speak to. */
	get defined() {
		return this.resolved.filter((t) => t.hasDefinition);
	}

	/** Everything a picker offers — the context's suggestions, minus nothing and duplicating nothing. */
	get options() {
		return [...new Set(this.suggestions)];
	}

	/** The Selection a chip picker renders — stored value widened by the context's suggestions. */
	get picker() {
		return new Selection({ ...this.selection.toRaw(), options: this.options });
	}

	toggle(tag) {
		return new Tags(this.selection.toggle(tag), this.glossary, this.suggestions);
	}

	/** Idempotent add — the tag ends up present whether or not it already was. */
	select(tag) {
		return new Tags(this.selection.select(tag), this.glossary, this.suggestions);
	}

	/** The stored shape — the token list, identical for gear, creatures and members. */
	toRaw() {
		return this.values;
	}
}
