let _cache = null;

export class FoundryInventoryRepository {
	async getAll() {
		if (_cache) return _cache;
		const pack = game.packs.get("stonetop.inventory-items");
		if (!pack) return [];
		await pack.getIndex({ fields: [
			"system.slug", "system.inventoryColumn", "system.sortOrder",
			"system.weight", "system.note", "system.resourceLabels",
			"system.breakBefore", "system.smallGrid", "system.twoCol",
		]});
		_cache = [...pack.index].sort((a, b) =>
			(a.system.sortOrder ?? 0) - (b.system.sortOrder ?? 0)
		);
		return _cache;
	}
}
