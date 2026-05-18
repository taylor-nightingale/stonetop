const _cache = new Map();

export class FoundryArcanaRepository {
	async findBySlug(slug) {
		if (_cache.has(slug)) return _cache.get(slug);
		const pack = game.packs.get("stonetop.arcana");
		if (!pack) return null;
		await pack.getIndex({ fields: ["system.slug"] });
		const entry = pack.index.find(e => e.system?.slug === slug);
		if (!entry) return null;
		const doc = await pack.getDocument(entry._id);
		const data = doc.system;
		_cache.set(slug, data);
		return data;
	}

	async findBySlugs(slugs) {
		return (await Promise.all(slugs.map(s => this.findBySlug(s)))).filter(Boolean);
	}
}
