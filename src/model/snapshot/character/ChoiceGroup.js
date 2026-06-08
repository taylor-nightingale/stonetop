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

export class EntryRow {
	constructor(slug, content = {title: null, text: null}, note = null, track = null, input = null, followers = [], inlineDisplay = false, outfitItems = []) {
		this.type          = "entry";
		this.slug          = slug;
		this.content       = content;       // { title: string|null, text: string|null }
		this.note          = note;
		this.track         = track;         // null | { slug, checks: bool[], requires? }
		this.input         = input;         // null | { slug, placeholder, value }
		this.followers     = followers;     // FollowerSnapshot[]
		this.inlineDisplay = inlineDisplay;
		this.outfitItems   = outfitItems;   // OutfitItem[]
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

export class ChoiceGroup {
	constructor(slug, list) {
		this.slug = slug;
		this.list = list;
	}

	static fromPackData(entry, values = new ChoiceValues(), followersBySlug = {}) {
		const es = entry.slug;
		const list = (entry.list ?? []).map((item, idx) => {
			return this.buildRow(item, values, es, idx, followersBySlug);
		});
		return new ChoiceGroup(es, list);
	}

	static buildRow(item, values, es, idx, followersBySlug = {}) {
		if (item.type === "entry" || item.type === "heading" || item.type === "follower")
			return this.buildEntryRow(item, values, es, followersBySlug);
		return this.buildPickRow(item, es, idx, values);
	}

	static buildEntryRow(item, values, es, followersBySlug = {}) {
		let track = null;
		if (item.track && item.slug) {
			const count  = values.getCount(es, item.slug);
			const checks = Array.from({length: item.track.max ?? 1}, (_, i) => i < count);
			track = { slug: item.slug, checks, requires: item.track.requires ?? null };
		}
		const input = item.input
			? {
				slug:        `${item.slug}-input`,
				placeholder: item.input.placeholder ?? null,
				value:       values.getText(es, `${item.slug}-input`) || (item.input.default ?? ""),
			}
			: null;
		// Support both { content.text } (entry) and { title } (legacy follower)
		const text    = item.content?.text ?? item.title ?? null;
		const content = { title: item.content?.title ?? null, subHeading: item.content?.subHeading ?? null, subNote: item.content?.subNote ?? null, text };

		// Resolve follower slugs — new: item.followers[]; legacy: item.type === "follower" uses item.slug
		const followerSlugs = item.followers?.length
			? item.followers
			: (item.type === "follower" ? [item.slug] : []);
		const followers = followerSlugs.map(s => followersBySlug[s] ?? null).filter(Boolean);

		return new EntryRow(
			item.slug ?? null,
			content,
			item.note ?? null,
			track,
			input,
			followers,
			item.inlineDisplay ?? false,
			item.outfitItems ?? [],
		);
	}

	static buildPickRow(item, es, idx, values) {
		const radio          = (item.pickCount ?? 1) === 1;
		const rowKey         = `${es}-row-${idx}`;
		const siblingSlugsCsv = radio ? (item.options ?? []).map(o => o.slug).join(",") : null;
		return new ChoiceRow(
			(item.options ?? []).map(o => new ChoiceOption(o.slug, {
				text:        o.content?.title ?? o.text ?? null,
				description: o.content?.text  ?? o.description ?? null,
				checked:     values.getCount(es, o.slug) > 0,
				type:        o.type ?? null,
				fillValue:   o.type === "input" ? values.getText(es, o.slug + "-fill") : "",
			})),
			{inline: item.inline ?? false, rowKey, radio, siblingSlugsCsv},
		);
	}
}
