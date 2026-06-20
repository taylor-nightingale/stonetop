export class Possession {
	// `name` is the possession's display title — it lives on the item/document (`item.name`), not in
	// `system`, so callers that have the document pass it in; those building from `system` alone
	// (outfit-item / choice syncing) can omit it.
	constructor(data, name = "") {
		this.slug        = data.slug        ?? null;
		this.name        = name             ?? "";
		this.description = data.description ?? "";
		this.resource    = data.resource    ?? null;
		this.outfitItems = data.outfitItems ?? [];
		this.choices     = data.choices     ?? null;
		this.scaling     = data.scaling     ?? null;
		this.sortOrder   = data.sortOrder   ?? null;
	}
}
