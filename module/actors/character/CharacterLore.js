import {
	LoreEntrySnapshotBuilder,
	OptionSnapshotBuilder,
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
				const type = opt.type ?? (opt.max == null ? "heading" : "checkbox");
				const isText    = type === "text";
				const isHeading = type === "heading";
				return new OptionSnapshotBuilder()
					.withSlug(opt.slug)
					.withDescription(opt.description)
					.withType(type)
					.withMax(isText || isHeading ? 0 : (opt.max ?? 1))
					.withCount(isText || isHeading ? 0 : this.getCount(entry.slug, opt.slug))
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
