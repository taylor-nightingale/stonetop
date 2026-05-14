const _cache = new Map();

export class FoundryPlaybookRepository {
	async findBySlug(slug) {
		if (_cache.has(slug)) return _cache.get(slug);
		const pack = game.packs.get("stonetop.playbooks");
		if (!pack) return null;
		await pack.getIndex({ fields: ["system.slug"] });
		const entry = pack.index.find(e => e.system?.slug === slug);
		if (!entry) return null;
		const doc = await pack.getDocument(entry._id);
		const pb = doc.asPlaybook();
		_cache.set(slug, pb);
		return pb;
	}
}
