import { ChoiceGroup, ChoiceValues } from "../../model/snapshot/character/ChoiceGroup.js";
import {
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
	constructor(flags, followers = null) {
		this._flags     = flags;
		this._followers = followers;
	}

	get selectedSlug() {
		return this._flags.getFlag("selected") ?? "";
	}

	get _choiceValues() {
		return new ChoiceValues(this._flags.getFlag("choices") ?? {});
	}

	async selectBackground(slug) {
		await this._flags.setFlag("selected", slug);
	}

	async setChoiceValue(groupSlug, optionSlug, count) {
		await this._flags.setFlag("choices", this._choiceValues.set(groupSlug, optionSlug, count).toRaw());
	}

	async setFollowerChoiceValue(groupSlug, optionSlug, count) {
		await this.setChoiceValue(groupSlug, optionSlug, count);
		if (this._followers) {
			if (count > 0) await this._followers.addFollower(optionSlug);
			else           await this._followers.removeFollower(optionSlug);
		}
	}

	buildSnapshot(backgroundsData) {
		const savedSlug = this.selectedSlug || null;
		const cv        = this._choiceValues;

		const options = (backgroundsData ?? []).map(b => {
			const choices = b.choices
				? ChoiceGroup.fromPackData(b.choices, cv, {})
				: null;
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
