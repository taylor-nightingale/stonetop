import {
	BackgroundOptionSnapshotBuilder,
	BackgroundSection,
} from "../../model/snapshot/character/CharacterSnapshot.js";
import {toSlug} from "../../utils/slug.js";

export class CharacterBackgrounds {
	constructor(flags, followers = null, choiceController, resourceController) {
		this._flags            = flags;
		this._followers        = followers;
		this._choiceController = choiceController;
		this._resourceController = resourceController;
	}

	get selectedSlug() {
		return this._flags.getFlag("selected") ?? "";
	}

	async selectBackground(slug) {
		await this._flags.setFlag("selected", slug);
	}

	async setChoiceValue(namespace, optionSlug, count) {
		await this._choiceController.setCount(namespace, optionSlug, count);
	}

	async setFollowerChoiceValue(namespace, optionSlug, count) {
		await this._choiceController.setFollowerCount(namespace, optionSlug, count);
	}

	async setResource(slug, count) {
		await this._resourceController.set("backgrounds", slug, count);
	}

	async buildSnapshot(backgroundsData) {
		const savedSlug = this.selectedSlug || null;

		const options = [];
		for (const b of (backgroundsData ?? [])) {
			let choices = null;
			if (b.choices) {
				await this._choiceController.addGroup(b.slug, b.choices);
				choices = this._choiceController.buildGroupSnapshot(b.slug);
			}
			options.push(new BackgroundOptionSnapshotBuilder()
				.withSlug(b.slug)
				.withLabel(b.label)
				.withDescription(b.description ?? "")
				.withSelected(b.slug === savedSlug)
				.withMoves((b.moves ?? []).map(toSlug))
				.withChoices(choices)
				.withResource(this._resourceController.buildSnapshot("backgrounds", b.resource ?? null, b.slug))
				.build());
		}

		return new BackgroundSection(savedSlug, options);
	}
}
