export class ActorOutfitItems {
	constructor(actor) {
		this._actor = actor;
	}

	get _all() {
		return [...(this._actor.items ?? [])].filter(i => i.type === "outfitItem");
	}

	getAll() {
		return this._all;
	}

	getBySource(source) {
		return this._all.filter(i => i.system?.source === source);
	}

	async create(itemsData) {
		if (!itemsData.length) return;
		await this._actor.createEmbeddedDocuments("Item", itemsData);
	}

	async deleteBySource(source) {
		const ids = this.getBySource(source).map(i => i._id);
		if (!ids.length) return;
		await this._actor.deleteEmbeddedDocuments("Item", ids);
	}

	async deleteById(id) {
		await this._actor.deleteEmbeddedDocuments("Item", [id]);
	}

	async sync(source, itemsData) {
		await this.deleteBySource(source);
		await this.create(itemsData);
	}
}
