import {
	BackgroundOptionSnapshotBuilder,
	BackgroundSection,
} from "../../model/snapshot/character/CharacterSnapshot.js";
import { ResourceController } from "./ResourceController.js";

function _toSlug(name) {
	return name.toLowerCase()
		.replace(/['']/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

export class CharacterBackgrounds {
	constructor(flags, followers = null, choiceController) {
		this._flags           = flags;
		this._followers       = followers;
		this._resources       = new ResourceController(flags);
		this._choiceController = choiceController;
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
		await this._resources.set(slug, count);
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
				.withMoves((b.moves ?? []).map(_toSlug))
				.withChoices(choices)
				.withResource(this._resources.buildSnapshot(b.resource ?? null, b.slug))
				.build());
		}

		return new BackgroundSection(savedSlug, options);
	}
}
