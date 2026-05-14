let _cache = null;

export class FoundryBasicMoveRepository {
	async getAll() {
		if (_cache) return _cache;
		const pack = game.packs.get("stonetop.basic-moves");
		if (!pack) return [];
		await pack.getIndex({ fields: ["system.stat"] });
		_cache = [...pack.index];
		return _cache;
	}
}
