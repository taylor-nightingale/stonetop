export class ChoiceOption {
	constructor(slug, {text = null, description = null, checked = false, checks = null, requires = null, type = null, fillValue = ""} = {}) {
		this.slug        = slug;
		this.text        = text;
		this.description = description;
		this.checked     = checked;
		this.checks      = checks;      // non-null = count mode (array of bool)
		this.requires    = requires;
		this.type        = type;        // null | "input" (fill-in blank)
		this.fillValue   = fillValue;
	}
}

/** A follower slot on a choice entry — a pure REFERENCE, not the card data. It carries the link's slugs;
 *  the template resolves each slug against the normalized `followers.bySlug` registry at render. No
 *  follower data is duplicated into the choice tree. */
export class EntryRowFollowers {
	constructor(slugs, inlineDisplay = false) {
		this.slugs         = slugs;         // referenced follower slugs (the FollowerLink)
		this.inlineDisplay = inlineDisplay; // full card inline vs. a labelled checkbox row
	}
}

/** Inline move grants on a choice entry — a pure REFERENCE (slugs only); the template resolves each
 *  against the normalized `moves.bySlug` registry at render, rendering a rollable move-row. */
export class EntryRowMoves {
	constructor(slugs) {
		this.slugs = slugs;                 // inline move-grant slugs
	}
}

export class EntryRow {
	constructor(slug, content = {}, track = null, input = null, followers = null, outfitItems = [], indent = false, moves = null) {
		this.type          = "entry";
		this.slug          = slug;
		this.content       = content;       // { title, titleNote, subtitle, subtitleNote, text }
		this.track         = track;         // null | { slug, checks: bool[], requires? }
		this.input         = input;         // null | { slug, placeholder, value, type: "inline"|"rich" }
		this.followers     = followers;     // EntryRowFollowers | null
		this.moves         = moves;         // EntryRowMoves | null
		this.outfitItems   = outfitItems;   // OutfitItem[]
		this.indent        = indent;        // render tabbed in under the previous row
	}
}

export class ChoiceRow {
	constructor(options, {inline = false, rowKey = null, radio = true, siblingSlugsCsv = null} = {}) {
		this.type           = "choice";
		this.options        = options;   // ChoiceOption[]
		this.inline         = inline;
		this.rowKey         = rowKey;
		this.radio          = radio;
		this.siblingSlugsCsv = siblingSlugsCsv;
	}
}

/** Persistent values (counts and texts) keyed by (groupSlug, optionSlug). */
export class ChoiceValues {
	constructor(data = {}) {
		this._data = data;
	}

	getCount(groupSlug, slug) {
		return this._data[groupSlug]?.[slug] ?? 0;
	}

	getText(groupSlug, slug) {
		return this._data[groupSlug]?.[slug] ?? "";
	}

	set(groupSlug, slug, value) {
		return new ChoiceValues({
			...this._data,
			[groupSlug]: {...(this._data[groupSlug] ?? {}), [slug]: value},
		});
	}

	toRaw() {
		return this._data;
	}
}

/** The resolved snapshot of one choice group: a namespace slug and its rows (EntryRow | ChoiceRow).
 *  Built from pack data by the pure `buildChoiceGroup` function. */
export class ChoiceGroup {
	constructor(slug, list, title = null) {
		this.slug  = slug;
		this.list  = list;
		this.title = title; // optional section heading (e.g. the Hec'tumel Codex's "Spells of the Codex")
	}
}
