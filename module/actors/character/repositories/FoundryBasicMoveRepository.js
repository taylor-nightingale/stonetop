let _cache = null;

export class FoundryBasicMoveRepository {
	async getAll() {
		if (_cache) return _cache;
		const pack = game.packs.get("stonetop.basic-moves");
		if (!pack) return [];
		await pack.getIndex({ fields: ["system.rollType"] });
		_cache = [...pack.index];
		return _cache;
	}

	async getDocument(id) {
		const pack = game.packs.get("stonetop.basic-moves");
		if (!pack) return null;
		return pack.getDocument(id);
	}
}
