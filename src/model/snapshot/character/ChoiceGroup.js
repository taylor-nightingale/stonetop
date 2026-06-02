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

export class HeadingRow {
	constructor(slug, content = {title: null, text: null}, note = null, track = null, input = null) {
		this.type    = "heading";
		this.slug    = slug;
		this.content = content;  // { title: string|null, text: string|null }
		this.note    = note;
		this.track   = track;   // null | { slug, checks: bool[], requires? }
		this.input   = input;   // null | { slug, placeholder, value }
	}
}

export class FollowerRow {
	constructor(slug, follower, track, title, inlineDisplay) {
		this.type          = "follower";
		this.slug          = slug;
		this.follower      = follower;      // FollowerSnapshot | null
		this.track         = track;         // null | { slug, checks: bool[] } — null means no checkbox
		this.title         = title;         // HTML string, shown when !inlineDisplay
		this.inlineDisplay = inlineDisplay; // boolean — true: show full card; false: show title
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
		if (item.type === "heading")  return this.buildHeadingRow(item, values, es);
		if (item.type === "follower") return this.buildFollowerRow(item, values, es, followersBySlug);
		return this.buildPickRow(item, es, idx, values);
	}

	static buildHeadingRow(item, values, es) {
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
		const content = { title: item.content?.title ?? null, text: item.content?.text ?? null };
		return new HeadingRow(item.slug ?? null, content, item.note ?? null, track, input);
	}

	static buildPickRow(item, es, idx, values) {
		const radio          = (item.pickCount ?? 1) === 1;
		const rowKey         = `${es}-row-${idx}`;
		const siblingSlugsCsv = radio ? (item.options ?? []).map(o => o.slug).join(",") : null;
		return new ChoiceRow(
			(item.options ?? []).map(o => new ChoiceOption(o.slug, {
				text:        o.text,
				description: o.description ?? null,
				checked:     values.getCount(es, o.slug) > 0,
				type:        o.type ?? null,
				fillValue:   o.type === "input" ? values.getText(es, o.slug + "-fill") : "",
			})),
			{inline: item.inline ?? false, rowKey, radio, siblingSlugsCsv},
		);
	}

	static buildFollowerRow(item, values, es, followersBySlug) {
		const track = item.track
			? {
				slug:   item.slug,
				checks: Array.from({length: item.track.max ?? 1}, (_, i) =>
					i < values.getCount(es, item.slug)),
			}
			: null;
		return new FollowerRow(
			item.slug,
			followersBySlug[item.slug] ?? null,
			track,
			item.title         ?? "",
			item.inlineDisplay ?? false,
		);
	}
}
