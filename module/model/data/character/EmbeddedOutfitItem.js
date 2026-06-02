export class EmbeddedOutfitItemBuilder {
	withSlug(v)            { this._slug            = v; return this; }
	withName(v)            { this._name            = v; return this; }
	withWeight(v)          { this._weight          = v; return this; }
	withTags(v)            { this._tags            = v; return this; }
	withNote(v)            { this._note            = v; return this; }
	withInventoryColumn(v) { this._inventoryColumn = v; return this; }
	withResource(v)        { this._resource        = v; return this; }
	withTwoCol(v)          { this._twoCol          = v; return this; }
	withSource(v)          { this._source          = v; return this; }

	build() {
		return {
			name:   this._name,
			type:   "outfitItem",
			system: {
				slug:            this._slug            ?? null,
				inventoryColumn: this._inventoryColumn ?? "regular",
				weight:          this._weight          ?? 0,
				tags:            this._tags            ?? "",
				note:            this._note            ?? null,
				resource:        this._resource        ?? null,
				twoCol:          this._twoCol          ?? false,
				source:          this._source          ?? null,
			},
		};
	}
}
