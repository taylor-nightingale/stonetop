export class PostDeathInsert {
	constructor(doc) {
		this.slug        = doc.system?.slug        ?? "";
		this.name        = doc.name                ?? "";
		this.img         = doc.img                 ?? null;
		this.description = doc.system?.description ?? null;
		this.instinct    = doc.system?.instinct    ?? null;
		this.lore        = doc.system?.choices     ?? [];
	}
}
