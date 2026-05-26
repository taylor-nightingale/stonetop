import {StonetopFlags} from "../character/StonetopFlags.js";
import {FoundrySteadingImprovementRepository} from "./repositories/FoundrySteadingImprovementRepository.js";
import {SteadingDefaults} from "../../model/data/steading/SteadingDefaults.js";
import {
	ContentSection,
	DebilitySnapshot,
	FortunesSnapshot,
	SteadingSnapshot,
	SurplusSnapshot,
} from "../../model/snapshot/steading/SteadingSnapshot.js";
import {ChoiceGroup, ChoiceValues} from "../../model/snapshot/character/ChoiceGroup.js";
import {PlacesOfInterest} from "./PlacesOfInterest.js";
import {SteadingAttributes} from "./SteadingAttributes.js";

export class StonetopSteading {
	constructor(actor) {
		this._actor = actor;
		this.placesOfInterest = new PlacesOfInterest(actor);
		this.attributes = new SteadingAttributes(actor);
	}

	get type() {
		return "steading";
	}

	get _flags() {
		return this.__flags ??= new StonetopFlags(this._actor, "steading");
	}

	get _impFlags() {
		return this.__impFlags ??= new StonetopFlags(this._actor, "improvements");
	}

	get _improvementsRepo() {
		return this.__repo ??= new FoundrySteadingImprovementRepository();
	}

	get fortunesCurrent() {
		return this._flags.getFlag("fortunes") ?? SteadingDefaults.fortunes.current;
	}

	get surplusCurrent() {
		return this._flags.getFlag("surplus") ?? SteadingDefaults.surplus.current;
	}

	get debilityState() {
		return this._flags.getFlag("debilities") ?? {};
	}

	get notes() {
		return this._flags.getFlag("notes") ?? "";
	}

	get residents() {
		return this._flags.getFlag("residents") ?? [];
	}

	get neighbors() {
		return this._flags.getFlag("neighbors") ?? {people: [], places: []};
	}

	get contentState() {
		return this._flags.getFlag("content") ?? {};
	}

	get assetsState() {
		return this._flags.getFlag("assets") ?? {};
	}

	get _improvementValues() {
		return new ChoiceValues(this._impFlags.getFlag("pickValues") ?? {});
	}

	async setFortunes(index) {
		await this._flags.setFlag("fortunes", index);
	}

	async setSurplus(value) {
		await this._flags.setFlag("surplus", value);
	}

	async setDebility(slug, active) {
		await this._flags.setFlag("debilities", {...this.debilityState, [slug]: active});
	}

	async setNotes(value) {
		await this._flags.setFlag("notes", value);
	}

	async setResidents(list) {
		await this._flags.setFlag("residents", list);
	}

	async setNeighbors(data) {
		await this._flags.setFlag("neighbors", data);
	}

	async setContent(data) {
		await this._flags.setFlag("content", data);
	}

	async setAssets(data) {
		await this._flags.setFlag("assets", data);
	}

	async setExtraPlaces(list) {
		await this._flags.setFlag("extraPlaces", list);
	}

	async setImprovementTrack(groupSlug, optionSlug, count) {
		const cv = this._improvementValues.set(groupSlug, optionSlug, count);
		await this._impFlags.setFlag("pickValues", cv.toRaw());
	}

	// -- Snapshot ---------------------------------------------------------

	async buildSnapshot() {
		const allImprovements = await this._improvementsRepo.getAll();
		const improvements = allImprovements
			.filter(imp => imp.choices != null)
			.map(imp => ChoiceGroup.fromPackData(imp.choices, this._improvementValues));

		return new SteadingSnapshot({
			fortunes: new FortunesSnapshot(
				SteadingDefaults.fortunes.title, SteadingDefaults.fortunes.note,
				this.fortunesCurrent, SteadingDefaults.fortunes.options,
			),
			surplus: new SurplusSnapshot(
				SteadingDefaults.surplus.title, SteadingDefaults.surplus.note, this.surplusCurrent,
			),
			attributes: this.attributes.buildSnapshot(),
			debilities: SteadingDefaults.debilities.map(def => new DebilitySnapshot(
				def.slug, def.description, def.note, (this.debilityState)[def.slug] ?? false,
			)),
			placesOfInterest: await this.placesOfInterest.buildSnapshot(),
			notes: this.notes,
			residents: this.residents,
			neighbors: this.neighbors,
			contentDescription: SteadingDefaults.content.description,
			content: [
				new ContentSection("excluded", "Excluded Content", "(Not part of the game, on-camera or off)", this.contentState.excluded ?? []),
				new ContentSection("veiled", "Veiled Content", "(Part of the fiction, but only off-camera)", this.contentState.veiled ?? []),
				new ContentSection("specialHandling", "Special Handling", null, this.contentState.specialHandling ?? []),
			],
			assets: {
				coinage: this.assetsState.coinage ?? SteadingDefaults.assets.coinage,
			},
			improvements,
		});
	}

}


