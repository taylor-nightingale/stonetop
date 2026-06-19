// First-class "pick from a list (+ optional custom entry)" value, used by tags (multi-select)
// and instinct / cost (single-select). Queryable (e.g. tags.has("group")) and consistent
// across playbook, follower, NPC, and companion. See follower-data-architecture.md.
// Immutable: toggle() returns a new Selection.
export class Selection {
	constructor({ selected = [], options = [], multi = false, allowCustom = true } = {}) {
		this.selected    = [...selected];
		this.options     = [...options];
		this.multi       = multi;
		this.allowCustom = allowCustom;
	}

	static single(value = null, { options = [], allowCustom = true } = {}) {
		const selected = (value === null || value === undefined || value === "") ? [] : [value];
		return new Selection({ selected, options, multi: false, allowCustom });
	}

	static multi(values = [], { options = [], allowCustom = true } = {}) {
		return new Selection({ selected: values, options, multi: true, allowCustom });
	}

	/**
	 * Normalize stored data into a Selection. Tolerates the legacy free string ("a, b, c"),
	 * the structured object, and an existing Selection — this same parse is the migration.
	 */
	static fromStored(raw, { multi = true, options = [], allowCustom = true } = {}) {
		if (raw instanceof Selection) return raw;
		if (typeof raw === "string") {
			// Multi splits on commas; single keeps the whole string (it may contain commas).
			const selected = multi
				? raw.split(",").map(t => t.trim()).filter(Boolean)
				: (raw.trim() ? [raw.trim()] : []);
			return new Selection({ selected, options, multi, allowCustom });
		}
		if (raw && typeof raw === "object") return new Selection(raw);
		return new Selection({ options, multi, allowCustom });
	}

	/** First selected value — convenience for single-select fields. */
	get value()  { return this.selected[0] ?? null; }
	get values() { return [...this.selected]; }
	get isEmpty() { return this.selected.length === 0; }
	/** Comma-joined display string (round-trips with the legacy free-string form). */
	get text()   { return this.selected.join(", "); }

	has(tag) { return this.selected.includes(tag); }

	/** Options not yet selected — suggestions for the "add" affordance. */
	get unselectedOptions() { return this.options.filter(o => !this.has(o)); }

	/** Renderable chips: every option (selected or not) plus any custom-selected tag. */
	get chips() {
		const fromOptions = this.options.map(value => ({ value, selected: this.has(value), custom: false }));
		const customs = this.selected
			.filter(v => !this.options.includes(v))
			.map(value => ({ value, selected: true, custom: true }));
		return [...fromOptions, ...customs];
	}

	/** New Selection with `tag` toggled (multi) or set/cleared (single). */
	toggle(tag) {
		if (!this.multi) {
			return this._with({ selected: this.has(tag) ? [] : [tag] });
		}
		const selected = this.has(tag)
			? this.selected.filter(t => t !== tag)
			: [...this.selected, tag];
		return this._with({ selected });
	}

	_with(patch) {
		return new Selection({
			selected: this.selected, options: this.options,
			multi: this.multi, allowCustom: this.allowCustom, ...patch,
		});
	}

	toRaw() {
		return { selected: [...this.selected], options: [...this.options], multi: this.multi, allowCustom: this.allowCustom };
	}
}
