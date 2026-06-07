import { ResourceBuilder } from "../../model/snapshot/ResourceSnapshot.js";

export class ResourceController {
	constructor(actor, systemSection = "resources") {
		this._actor   = actor;
		this._section = systemSection;
	}

	get _allCounts() { return this._actor.system?.[this._section]?.counts ?? {}; }

	_countsFor(namespace) { return this._allCounts[namespace] ?? {}; }

	getCurrent(namespace, slug) { return this._countsFor(namespace)[slug] ?? 0; }

	async set(namespace, slug, count) {
		await this._actor.update({
			[`system.${this._section}.counts`]: {
				...this._allCounts,
				[namespace]: { ...this._countsFor(namespace), [slug]: count },
			},
		});
	}

	buildSnapshot(namespace, def, slug) {
		return ResourceController.build(def, this.getCurrent(namespace, slug));
	}

	static build(def, current) {
		if (!def) return null;
		return new ResourceBuilder()
			.withCurrent(current)
			.withMax(def.max ?? null)
			.withMaxStat(def.maxStat ?? null)
			.withTitle(def.title ?? null)
			.withLabels(def.labels ?? [])
			.build();
	}
}
