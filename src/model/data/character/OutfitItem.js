export class OutfitItem {
	// Map a raw `outfitItem` document (pack entry, world item, or the item sheet's own document)
	// onto the entity. `group` is the folder-derived section name — only pack entries have one.
	static fromDocument(item, group = null) {
		const sys = item.system ?? {};
		return new OutfitItemBuilder()
			.withSlug(sys.slug)
			.withName(item.name)
			.withWeight(sys.weight ?? 0)
			.withTags(sys.tagList ?? "")
			.withNote(sys.note ?? null)
			.withInventoryColumn(sys.inventoryColumn ?? null)
			.withResource(sys.resource ?? null)
			.withTwoCol(sys.twoCol ?? false)
			.withGroup(group)
			.withArmor(sys.armor ?? null)
			.build();
	}

	constructor(b) {
		this.slug            = b._slug;
		this.name            = b._name;
		this.weight          = b._weight;
		this.tags            = b._tags            ?? "";
		this.note            = b._note;
		this.inventoryColumn = b._inventoryColumn;
		this.resource        = b._resource;
		this.twoCol          = b._twoCol;
		this.group           = b._group  ?? null;
		this.armor           = b._armor  ?? null;
		this.ownedId         = b._ownedId ?? null;
	}
}

export class OutfitItemBuilder {
	withSlug(v)            { this._slug            = v; return this; }
	withName(v)            { this._name            = v; return this; }
	withWeight(v)          { this._weight          = v; return this; }
	withTags(v)            { this._tags            = v; return this; }
	withNote(v)            { this._note            = v; return this; }
	withInventoryColumn(v) { this._inventoryColumn = v; return this; }
	withResource(v)        { this._resource        = v; return this; }
	withTwoCol(v)          { this._twoCol          = v; return this; }
	withGroup(v)           { this._group           = v; return this; }
	withArmor(v)           { this._armor           = v; return this; }
	withOwnedId(v)         { this._ownedId         = v; return this; }
	build()                { return new OutfitItem(this); }
}
