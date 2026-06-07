import { FakeWorldItemStore } from "./FakeWorldItemStore.js";

export class FakeArcanaRepository {
	_worldStore = new FakeWorldItemStore();

	constructor(arcana = []) { this._arcana = arcana; }

	addWorld(item) { this._worldStore.add(item); return this; }

	async findBySlug(slug) {
		const direct = this._arcana.find(a => a.slug === slug);
		if (direct) return direct;
		const world = await this._worldStore.findEntry(e => e.system?.slug === slug);
		if (!world) return null;
		return {
			slug:  world.system.slug,
			major: world.system.major ?? false,
			name:  world.name  ?? null,
			img:   world.img   ?? null,
			front: world.system.front ?? null,
			back:  world.system.back  ?? null,
		};
	}

	async findBySlugs(slugs) {
		return (await Promise.all(slugs.map(s => this.findBySlug(s)))).filter(Boolean);
	}

	add(arcanum) {
		this._arcana.push(arcanum);
	}
}
