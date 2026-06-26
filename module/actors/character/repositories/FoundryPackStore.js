export class FoundryPackStore {
	constructor(packName, fields) {
		this._packName = packName;
		this._fields   = fields;
		this._indexed  = false;
	}

	async _ensureIndexed() {
		const pack = game.packs.get(this._packName);
		if (!pack) return null;
		if (!this._indexed) {
			await pack.getIndex({ fields: this._fields });
			this._indexed = true;
		}
		return pack;
	}

	async findEntry(predicate) {
		const pack = await this._ensureIndexed();
		if (!pack) return null;
		return pack.index.find(predicate) ?? null;
	}

	async filterEntries(predicate) {
		const pack = await this._ensureIndexed();
		if (!pack) return [];
		return [...pack.index].filter(predicate);
	}

	async getAll() {
		const pack = await this._ensureIndexed();
		if (!pack) return [];
		return [...pack.index];
	}

	async getDocument(id) {
		const pack = game.packs.get(this._packName);
		if (!pack) return null;
		return pack.getDocument(id);
	}
}
