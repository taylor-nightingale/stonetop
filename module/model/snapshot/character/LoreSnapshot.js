export class LoreOptionSnapshot {
	constructor(b) {
		this.slug = b._slug;
		this.description = b._description;
		this.type = b._type ?? "checkbox";
		this.max = this.type === "text" ? 0 : (b._max ?? 1);
		this.count = this.type === "text" ? 0 : (b._count ?? 0);
		this.checks = this.type === "text" ? [] : Array.from({length: this.max}, (_, i) => i < this.count);
		this.textValue = this.type === "text" ? (b._textValue ?? "") : null;
		this.requires = b._requires ?? null;
	}
}

export class OptionSnapshotBuilder {
	withSlug(v) {
		this._slug = v;
		return this;
	}

	withDescription(v) {
		this._description = v;
		return this;
	}

	withType(v) {
		this._type = v;
		return this;
	}

	withMax(v) {
		this._max = v;
		return this;
	}

	withCount(v) {
		this._count = v;
		return this;
	}

	withTextValue(v) {
		this._textValue = v;
		return this;
	}

	withRequires(v) {
		this._requires = v;
		return this;
	}

	build() {
		return new LoreOptionSnapshot(this);
	}
}

export class LoreEntrySnapshot {
	constructor(b) {
		this.slug = b._slug;
		this.title = b._title;
		this.description = b._description;
		this.options = b._options;
	}
}

export class LoreEntrySnapshotBuilder {
	withSlug(v) {
		this._slug = v;
		return this;
	}

	withTitle(v) {
		this._title = v;
		return this;
	}

	withDescription(v) {
		this._description = v;
		return this;
	}

	withOptions(v) {
		this._options = v;
		return this;
	}

	build() {
		return new LoreEntrySnapshot(this);
	}
}

export class LoreSection {
	constructor(entries) {
		this.entries = entries;
	}

	get hasEntries() {
		return this.entries.length > 0;
	}
}

/** One option with description and selection state. Used for follower instinct/cost. */
export class SelectableOptionSnapshot {
	constructor(description, selected) {
		this.description = description;
		this.selected = selected;
	}
}
