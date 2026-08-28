import { Tags } from "../Tags.js";

export class EmbeddedOutfitItemBuilder {
	withSlug(v)            { this._slug            = v; return this; }
	withName(v)            { this._name            = v; return this; }
	withQualifier(v)       { this._qualifier       = v; return this; }
	withWeight(v)          { this._weight          = v; return this; }
	withTags(v)            { this._tags            = v; return this; }
	withNote(v)            { this._note            = v; return this; }
	withInventoryColumn(v) { this._inventoryColumn = v; return this; }
	withResource(v)        { this._resource        = v; return this; }

	build() {
		return {
			name:   this._name,
			type:   "outfitItem",
			system: {
				slug:            this._slug            ?? null,
				qualifier:       this._qualifier       ?? "",
				inventoryColumn: this._inventoryColumn ?? "regular",
				weight:          this._weight          ?? 0,
				tagList:         Tags.gear(this._tags).toRaw(),
				note:            this._note            ?? null,
				resource:        this._resource        ?? null,
			},
		};
	}
}
