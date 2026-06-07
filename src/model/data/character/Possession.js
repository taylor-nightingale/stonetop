export class Possession {
	constructor(data) {
		this.slug        = data.slug        ?? null;
		this.label       = data.label       ?? "";
		this.description = data.description ?? "";
		this.resource    = data.resource    ?? null;
		this.outfitItems = data.outfitItems ?? [];
		this.choices     = data.choices     ?? null;
		this.scaling     = data.scaling     ?? null;
		this.sortOrder   = data.sortOrder   ?? null;
	}
}
