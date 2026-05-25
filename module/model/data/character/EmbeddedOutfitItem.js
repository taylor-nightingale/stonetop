export class EmbeddedOutfitItemBuilder {
	withSlug(v)            { this._slug            = v; return this; }
	withName(v)            { this._name            = v; return this; }
	withWeight(v)          { this._weight          = v; return this; }
	withNote(v)            { this._note            = v; return this; }
	withInventoryColumn(v) { this._inventoryColumn = v; return this; }
	withResource(v)        { this._resource        = v; return this; }
	withTwoCol(v)          { this._twoCol          = v; return this; }
	withBreakBefore(v)     { this._breakBefore     = v; return this; }
	withSource(v)          { this._source          = v; return this; }

	build() {
		return {
			name:   this._name,
			type:   "equipment",
			system: { equipmentType: "outfit", weight: this._weight ?? 0 },
			flags:  {
				stonetop: {
					slug:            this._slug            ?? null,
					inventoryColumn: this._inventoryColumn ?? "regular",
					note:            this._note            ?? null,
					resource:        this._resource        ?? null,
					twoCol:          this._twoCol          ?? false,
					breakBefore:     this._breakBefore     ?? false,
					source:          this._source          ?? null,
				},
			},
		};
	}
}
