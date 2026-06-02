import { ResourceBuilder } from "../../model/snapshot/ResourceSnapshot.js";

export class ResourceController {
	constructor(flags) {
		this._flags = flags;
	}

	get _allCounts() { return this._flags.getFlag("counts") ?? {}; }

	_countsFor(namespace) { return this._allCounts[namespace] ?? {}; }

	getCurrent(namespace, slug) { return this._countsFor(namespace)[slug] ?? 0; }

	async set(namespace, slug, count) {
		const all = this._allCounts;
		await this._flags.setFlag("counts", { ...all, [namespace]: { ...this._countsFor(namespace), [slug]: count } });
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
