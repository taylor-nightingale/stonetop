import { Tags } from "../Tags.js";

export class OutfitItem {
	// Map a raw `outfitItem` document (pack entry, world item, or the item sheet's own document)
	// onto the entity. Nothing about where it is FILED comes along: grouping is the page's business.
	static fromDocument(item) {
		const sys = item.system ?? {};
		return new OutfitItemBuilder()
			.withSlug(sys.slug)
			.withName(item.name)
			.withQualifier(sys.qualifier ?? "")
			.withWeight(sys.weight ?? 0)
			.withTags(Tags.gear(sys.tagList))
			.withNote(sys.note ?? null)
			.withInventoryColumn(sys.inventoryColumn ?? null)
			.withResource(sys.resource ?? null)
			.withArmor(sys.armor ?? null)
			.build();
	}

	constructor(b) {
		this.slug            = b._slug;
		this.name            = b._name;
		this.qualifier       = b._qualifier       ?? "";
		this.weight          = b._weight;
		this.tags            = b._tags            ?? Tags.gear(null);
		this.note            = b._note;
		this.inventoryColumn = b._inventoryColumn;
		this.resource        = b._resource;
		this.armor           = b._armor  ?? null;
		this.ownedId         = b._ownedId ?? null;
	}

	/** The name as the book prints it — "Rope, ~25 ft". The halves are stored apart because only the
	 *  first is the item; rejoining them is what matches a printed row or a value-table entry. */
	get fullName() {
		return this.qualifier ? `${this.name}, ${this.qualifier}` : this.name;
	}
}

export class OutfitItemBuilder {
	withSlug(v)            { this._slug            = v; return this; }
	withName(v)            { this._name            = v; return this; }
	withQualifier(v)       { this._qualifier       = v; return this; }
	withWeight(v)          { this._weight          = v; return this; }
	withTags(v)            { this._tags            = v; return this; }
	withNote(v)            { this._note            = v; return this; }
	withInventoryColumn(v) { this._inventoryColumn = v; return this; }
	withResource(v)        { this._resource        = v; return this; }
	withArmor(v)           { this._armor           = v; return this; }
	withOwnedId(v)         { this._ownedId         = v; return this; }
	build()                { return new OutfitItem(this); }
}
