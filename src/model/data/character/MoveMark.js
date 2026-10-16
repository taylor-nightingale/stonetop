/**
 * A background marking options on a move's own choice group — the Seeker's backgrounds make you
 * Well Versed in a topic. Stored on the background def as one entry of its `moveMarks` list:
 *
 *   "moveMarks": [ { "move": "well-versed", "group": "topics", "options": ["things-below"] } ]
 *
 * One option is a fixed mark (the Patriot's Things Below). Several are a pick of one (the Witch
 * Hunter's Fae, Things Below or Last Door); the pick is stored in the background's own choice values,
 * under a namespace of the background's, and the option text is the move's — never copied here.
 */
export class MoveMark {
	static listFrom(raw) {
		if (!Array.isArray(raw)) return [];
		return raw
			.filter(m => m?.move && m?.group && Array.isArray(m.options) && m.options.length)
			.map(m => new MoveMark(m));
	}

	constructor({ move, group, options }) {
		this.moveSlug  = move;
		this.groupSlug = group;
		this.options   = [...options];
	}

	get isFixed() { return this.options.length === 1; }

	offers(optionSlug) { return this.options.includes(optionSlug); }

	/** Where a background's pick is stored among its choice values. */
	namespaceFor(backgroundSlug) {
		return `${backgroundSlug}-${this.moveSlug}`;
	}

	/** @param {ChoiceValues} values the background choice values */
	markedOption(values, backgroundSlug) {
		if (this.isFixed) return this.options[0];
		const namespace = this.namespaceFor(backgroundSlug);
		return this.options.find(slug => values.getCount(namespace, slug) > 0) ?? null;
	}

	/**
	 * The pick a background card draws for a mark with a choice in it.
	 * @param {object|null} moveChoices the move's own `choices` group, which owns each option's text
	 */
	pickGroup(backgroundSlug, moveChoices) {
		if (this.isFixed) return null;
		const rows    = new Map((moveChoices?.list ?? []).filter(r => r?.slug).map(r => [r.slug, r]));
		const options = this.options
			.filter(slug => rows.has(slug))
			.map(slug => ({ slug, text: rows.get(slug).content?.text ?? null }));
		if (!options.length) return null;
		return {
			slug: this.namespaceFor(backgroundSlug),
			list: [{ type: "pick", pickCount: 1, options }],
		};
	}
}
