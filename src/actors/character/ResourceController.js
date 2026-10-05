import { ResourceBuilder } from "../../model/snapshot/ResourceSnapshot.js";

export class ResourceController {
	constructor(actor, systemSection = "resources") {
		this._actor   = actor;
		this._section = systemSection;
	}

	get _allCounts() { return this._actor.system?.[this._section]?.counts ?? {}; }

	_countsFor(namespace) { return this._allCounts[namespace] ?? {}; }

	/** The saved count, or `starting` while none is saved — a saved 0 is spent, not unset. */
	getCurrent(namespace, slug, starting = 0) { return this._countsFor(namespace)[slug] ?? starting; }

	async set(namespace, slug, count) {
		await this._actor.update({
			[`system.${this._section}.counts`]: {
				...this._allCounts,
				[namespace]: { ...this._countsFor(namespace), [slug]: count },
			},
		});
	}

	// Fill-in-blank text for a resource with an `input` def, stored alongside `counts` under
	// `system.<section>.texts[namespace][slug]`.
	get _allTexts() { return this._actor.system?.[this._section]?.texts ?? {}; }

	_textsFor(namespace) { return this._allTexts[namespace] ?? {}; }

	getText(namespace, slug) { return this._textsFor(namespace)[slug] ?? ""; }

	async setText(namespace, slug, value) {
		await this._actor.update({
			[`system.${this._section}.texts`]: {
				...this._allTexts,
				[namespace]: { ...this._textsFor(namespace), [slug]: value },
			},
		});
	}

	buildSnapshot(namespace, def, slug) {
		return ResourceController.build(def, this.getCurrent(namespace, slug), this.getText(namespace, slug));
	}

	static build(def, current, inputValue = "") {
		if (!def) return null;
		const input = def.input
			? {
				value:       inputValue || (def.input.default ?? ""),
				placeholder: def.input.placeholder ?? null,
				type:        def.input.type ?? "inline",
			}
			: null;
		return new ResourceBuilder()
			.withCurrent(current)
			.withMax(def.max ?? null)
			.withMaxStat(def.maxStat ?? null)
			.withTitle(def.title ?? null)
			.withLabels(def.labels ?? [])
			.withInput(input)
			.build();
	}
}
