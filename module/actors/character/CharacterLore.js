import {
	LoreEntrySnapshotBuilder,
	LoreOptionSnapshotBuilder,
	LoreSection,
} from "../../model/snapshot/character/CharacterSnapshot.js";

export class CharacterLore {
	constructor(flags) {
		this._flags = flags;
	}

	get counts() {
		return this._flags.getFlag("counts") ?? {};
	}

	getCount(entrySlug, optionSlug) {
		return this.counts[entrySlug]?.[optionSlug] ?? 0;
	}

	async setCount(entrySlug, optionSlug, count) {
		const c = this.counts;
		await this._flags.setFlag("counts", { ...c, [entrySlug]: { ...(c[entrySlug] ?? {}), [optionSlug]: count } });
	}

	get texts() {
		return this._flags.getFlag("texts") ?? {};
	}

	getText(entrySlug, optionSlug) {
		return this.texts[entrySlug]?.[optionSlug] ?? "";
	}

	async setText(entrySlug, optionSlug, value) {
		const t = this.texts;
		await this._flags.setFlag("texts", { ...t, [entrySlug]: { ...(t[entrySlug] ?? {}), [optionSlug]: value } });
	}

	buildSnapshot(loreData) {
		const entries = (loreData ?? []).map(entry => {
			const options = (entry.options ?? []).map(opt => {
				const isText = (opt.type ?? "checkbox") === "text";
				return new LoreOptionSnapshotBuilder()
					.withSlug(opt.slug)
					.withDescription(opt.description)
					.withType(opt.type ?? "checkbox")
					.withMax(isText ? 0 : (opt.max ?? 1))
					.withCount(isText ? 0 : this.getCount(entry.slug, opt.slug))
					.withTextValue(isText ? this.getText(entry.slug, opt.slug) : null)
					.build();
			});
			return new LoreEntrySnapshotBuilder()
				.withSlug(entry.slug)
				.withTitle(entry.title)
				.withDescription(entry.description ?? "")
				.withOptions(options)
				.build();
		});
		return new LoreSection(entries);
	}
}
