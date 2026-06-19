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
	constructor(slug, content = {}, track = null, input = null, followers = [], inlineDisplay = false, outfitItems = []) {
		this.type          = "entry";
		this.slug          = slug;
		this.content       = content;       // { title, titleNote, subtitle, subtitleNote, text }
		this.track         = track;         // null | { slug, checks: bool[], requires? }
		this.input         = input;         // null | { slug, placeholder, value, type: "inline"|"rich" }
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
		// Picks carry an explicit type in pack data but are identified only by an `options`
		// array in character groupDefs — route both to buildPickRow.
		return (item.type === "pick" || Array.isArray(item.options))
			? this.buildPickRow(item, es, idx, values)
			: this.buildEntryRow(item, values, es, followersBySlug);
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
				type:        item.input.type ?? "inline",
			}
			: null;
		const c = item.content ?? {};
		const content = {
			title:        c.title ?? null,
			titleNote:    c.titleNote ?? null,
			subtitle:     c.subtitle ?? null,
			subtitleNote: c.subtitleNote ?? null,
			text:         c.text ?? null,
		};

		const followers = (item.followers ?? []).map(s => followersBySlug[s] ?? null).filter(Boolean);

		return new EntryRow(
			item.slug ?? null,
			content,
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
