import {
	BackgroundOptionSnapshotBuilder,
	BackgroundSection,
} from "../../model/snapshot/character/CharacterSnapshot.js";
import { ChoiceGroup, ChoiceValues } from "../../model/snapshot/character/ChoiceGroup.js";
import { toSlug } from "../../utils/slug.js";

export class CharacterBackgrounds {
	constructor(actor, factory, resourceController) {
		this._actor              = actor;
		this._resourceController = resourceController;
		this._ctrl               = factory.forItemType("playbook", "backgroundValues",
			(ns, item) => item?.system?.backgrounds?.find(b => b.slug === ns)?.choices ?? null,
		);
	}

	get selectedSlug() {
		return this._actor.system?.background?.selected ?? "";
	}

	async selectBackground(slug) {
		await this._actor.update({ "system.background.selected": slug });
	}

	async setChoiceValue(namespace, optionSlug, count) {
		await this._ctrl.setCount(namespace, optionSlug, count);
	}

	async setResource(slug, count) {
		await this._resourceController.set("backgrounds", slug, count);
	}

	async buildSnapshot(backgroundsData) {
		const savedSlug = this.selectedSlug || null;
		const pbItem    = _findPlaybookItem(this._actor);
		const values    = new ChoiceValues(pbItem?.system?.backgroundValues ?? {});

		const options = [];
		for (const b of (backgroundsData ?? [])) {
			const choices = b.choices ? ChoiceGroup.fromPackData(b.choices, values) : null;
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

function _findPlaybookItem(actor) {
	return [...actor.items].find(i => i.type === "playbook") ?? null;
}
