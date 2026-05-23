import {
	BackgroundChoiceOptionSnapshot,
	BackgroundChoicesSnapshotBuilder,
	BackgroundOptionSnapshotBuilder,
	BackgroundSection,
} from "../../model/snapshot/character/CharacterSnapshot.js";

function _toSlug(name) {
	return name.toLowerCase()
		.replace(/['']/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

export class CharacterBackgrounds {
	constructor(flags) {
		this._flags = flags;
	}

	get selectedSlug() {
		return this._flags.getFlag("selected") ?? "";
	}

	get choices() {
		return this._flags.getFlag("choices") ?? {};
	}

	async selectBackground(slug) {
		await this._flags.setFlag("selected", slug);
	}

	async addChoice(choice) {
		const current = this.choices;
		await this._flags.setFlag("choices", { ...current, [choice.slug]: choice.isChecked });
	}

	buildSnapshot(backgroundsData) {
		const savedSlug    = this.selectedSlug || null;
		const savedChoices = this.choices;

		const options = (backgroundsData ?? []).map(b => {
			const choices = b.choices ? new BackgroundChoicesSnapshotBuilder()
				.withLabel(b.choices.label)
				.withCount(b.choices.count)
				.withCountLabel(b.choices.count.join(" or "))
				.withOptions(b.choices.options.map(o =>
					new BackgroundChoiceOptionSnapshot(o.slug, o.label, !!(savedChoices?.[o.slug]))
				))
				.withSaved(savedChoices)
				.build() : null;
			return new BackgroundOptionSnapshotBuilder()
				.withSlug(b.slug)
				.withLabel(b.label)
				.withDescription(b.description ?? "")
				.withSelected(b.slug === savedSlug)
				.withMoves((b.moves ?? []).map(_toSlug))
				.withChoices(choices)
				.build();
		});

		return new BackgroundSection(savedSlug, options);
	}
}
