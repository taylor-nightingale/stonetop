export class OutfitItem {
	constructor(b) {
		this.slug            = b._slug;
		this.name            = b._name;
		this.weight          = b._weight;
		this.note            = b._note;
		this.inventoryColumn = b._inventoryColumn;
		this.resource        = b._resource;
		this.twoCol          = b._twoCol;
		this.smallGrid       = b._smallGrid;
		this.breakBefore     = b._breakBefore;
	}
}

export class OutfitItemBuilder {
	withSlug(v)            { this._slug            = v; return this; }
	withName(v)            { this._name            = v; return this; }
	withWeight(v)          { this._weight          = v; return this; }
	withNote(v)            { this._note            = v; return this; }
	withInventoryColumn(v) { this._inventoryColumn = v; return this; }
	withResource(v)        { this._resource        = v; return this; }
	withTwoCol(v)          { this._twoCol          = v; return this; }
	withSmallGrid(v)       { this._smallGrid       = v; return this; }
	withBreakBefore(v)     { this._breakBefore     = v; return this; }
	build()                { return new OutfitItem(this); }
}
