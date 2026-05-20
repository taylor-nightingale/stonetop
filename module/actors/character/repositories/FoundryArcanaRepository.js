import { MinorArcanum } from "../../../model/MinorArcanum.js";

const _cache = new Map();

export class FoundryArcanaRepository {
	async findBySlug(slug) {
		if (_cache.has(slug)) return _cache.get(slug);
		const pack = game.packs.get("stonetop.arcana");
		if (!pack) return null;
		await pack.getIndex({ fields: ["flags.stonetop.slug"] });
		const entry = pack.index.find(e => e.flags?.stonetop?.slug === slug);
		if (!entry) return null;
		const doc = await pack.getDocument(entry._id);
		const arcanum = new MinorArcanum(doc.flags.stonetop);
		_cache.set(slug, arcanum);
		return arcanum;
	}

	async findBySlugs(slugs) {
		return (await Promise.all(slugs.map(s => this.findBySlug(s)))).filter(Boolean);
	}
}
