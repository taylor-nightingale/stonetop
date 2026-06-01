import { ResourceBuilder } from "../../model/snapshot/ResourceSnapshot.js";

export class ResourceController {
	constructor(flags) {
		this._flags = flags;
	}

	get _counts() { return this._flags.getFlag("resources") ?? {}; }

	getCurrent(slug) { return this._counts[slug] ?? 0; }

	async set(slug, count) {
		await this._flags.setFlag("resources", { ...this._counts, [slug]: count });
	}

	buildSnapshot(def, slug) {
		return ResourceController.build(def, this.getCurrent(slug));
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
