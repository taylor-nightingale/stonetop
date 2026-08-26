import {
	BackgroundOptionSnapshotBuilder,
	BackgroundSection,
} from "../../model/snapshot/character/CharacterSnapshot.js";
import { ChoiceValues } from "../../model/snapshot/character/ChoiceGroup.js";
import { buildChoiceGroup } from "../../model/snapshot/character/buildChoiceGroup.js";
import { rich } from "../../model/snapshot/RichText.js";
import { toSlug } from "../../utils/slug.js";

export class CharacterBackgrounds {
	constructor(actor, factory, resourceController) {
		this._actor              = actor;
		this._resourceController = resourceController;
		this._ctrl               = factory.forSingleton("playbook", "backgroundValues");
	}

	get selectedSlug() {
		return this._actor.system?.background?.selected ?? "";
	}

	async selectBackground(slug) {
		await this._actor.update({ "system.background.selected": slug });
	}

	/** The controller for background choice values — one store on the playbook item. */
	controller() { return this._ctrl; }

	async setChoiceValue(namespace, optionSlug, count) {
		await this._ctrl.setCount(namespace, optionSlug, count);
	}

	async setResource(slug, count) {
		await this._resourceController.set("backgrounds", slug, count);
	}

	// A background's own track, rolled by the move it grants (the Destined background's Omens). The
	// background names the track (resource.title), so nothing here needs a second place to declare the
	// stat. Null when the chosen background has no track by that name.
	resolveBonus(stat) {
		const background = this.selectedBackground(_findPlaybookItem(this._actor)?.system);
		const title      = background?.resource?.title;
		if (!title || toSlug(title) !== stat) return null;
		return this._resourceController.getCurrent("backgrounds", background.slug);
	}

	/** The chosen background's own definition, out of the playbook data that carries them all. */
	selectedBackground(playbookData) {
		const slug = this.selectedSlug;
		if (!slug) return null;
		return (playbookData?.backgrounds ?? []).find(b => b.slug === slug) ?? null;
	}

	async buildSnapshot(backgroundsData) {
		const savedSlug = this.selectedSlug || null;
		const pbItem    = _findPlaybookItem(this._actor);
		const values    = new ChoiceValues(pbItem?.system?.backgroundValues ?? {});

		const options = [];
		for (const b of (backgroundsData ?? [])) {
			const choices = b.choices ? buildChoiceGroup(b.choices, values) : null;
			options.push(new BackgroundOptionSnapshotBuilder()
				.withSlug(b.slug)
				.withLabel(rich(b.label))
				.withDescription(rich(b.description ?? ""))
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

