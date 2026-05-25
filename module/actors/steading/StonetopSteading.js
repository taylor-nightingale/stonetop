import { StonetopFlags } from "../character/StonetopFlags.js";
import { FoundrySteadingImprovementRepository } from "./repositories/FoundrySteadingImprovementRepository.js";
import { SteadingDefaults } from "../../model/data/steading/SteadingDefaults.js";
import {
	SteadingSnapshot, FortunesSnapshot, SurplusSnapshot,
	AttributeSnapshot, DebilitySnapshot, ContentSection,
} from "../../model/snapshot/steading/SteadingSnapshot.js";
import { ChoiceGroup, ChoiceValues } from "../../model/snapshot/character/ChoiceGroup.js";

export class StonetopSteading {
	constructor(actor) {
		this._actor = actor;
	}

	get type() { return "steading"; }

	get _flags()            { return this.__flags   ??= new StonetopFlags(this._actor, "steading"); }
	get _impFlags()         { return this.__impFlags ??= new StonetopFlags(this._actor, "improvements"); }
	get _improvementsRepo() { return this.__repo    ??= new FoundrySteadingImprovementRepository(); }

	// -- Flags accessors --------------------------------------------------

	get fortunesCurrent()  { return this._flags.getFlag("fortunes")    ?? SteadingDefaults.fortunes.current; }
	get surplusCurrent()   { return this._flags.getFlag("surplus")     ?? SteadingDefaults.surplus.current; }
	get attributeState()   { return this._flags.getFlag("attributes")  ?? {}; }
	get debilityState()    { return this._flags.getFlag("debilities")  ?? {}; }
	get notes()            { return this._flags.getFlag("notes")       ?? ""; }
	get residents()        { return this._flags.getFlag("residents")   ?? []; }
	get neighbors()        { return this._flags.getFlag("neighbors")   ?? { people: [], places: [] }; }
	get contentState()     { return this._flags.getFlag("content")     ?? {}; }
	get assetsState()      { return this._flags.getFlag("assets")      ?? {}; }
	get extraPlaces()      { return this._flags.getFlag("extraPlaces") ?? []; }

	get _improvementValues() {
		return new ChoiceValues(this._impFlags.getFlag("pickValues") ?? {});
	}

	// -- Mutations --------------------------------------------------------

	async setFortunes(index)              { await this._flags.setFlag("fortunes", index); }
	async setSurplus(value)               { await this._flags.setFlag("surplus", value); }
	async setAttributeCurrent(key, index) {
		const entry = this.attributeState[key] ?? {};
		await this._flags.setFlag("attributes", { ...this.attributeState, [key]: { ...entry, current: index } });
	}
	async setAttributeExtra(key, items) {
		const entry = this.attributeState[key] ?? {};
		await this._flags.setFlag("attributes", { ...this.attributeState, [key]: { ...entry, extra: items } });
	}
	async setDebility(slug, active) {
		await this._flags.setFlag("debilities", { ...this.debilityState, [slug]: active });
	}
	async setNotes(value)                 { await this._flags.setFlag("notes", value); }
	async setResidents(list)              { await this._flags.setFlag("residents", list); }
	async setNeighbors(data)             { await this._flags.setFlag("neighbors", data); }
	async setContent(data)               { await this._flags.setFlag("content", data); }
	async setAssets(data)                { await this._flags.setFlag("assets", data); }
	async setExtraPlaces(list)           { await this._flags.setFlag("extraPlaces", list); }

	async setImprovementTrack(groupSlug, optionSlug, count) {
		const cv = this._improvementValues.set(groupSlug, optionSlug, count);
		await this._impFlags.setFlag("pickValues", cv.toRaw());
	}

	// -- Snapshot ---------------------------------------------------------

	async buildSnapshot() {
		const d   = SteadingDefaults;
		const att = this.attributeState;
		const deb = this.debilityState;
		const con = this.contentState;
		const assets = this.assetsState;
		const impValues = this._improvementValues;

		const allImprovements = await this._improvementsRepo.getAll();
		const improvements = allImprovements
			.filter(imp => imp.choices != null)
			.map(imp => ChoiceGroup.fromPackData(imp.choices, impValues));

		return new SteadingSnapshot({
			fortunes: new FortunesSnapshot(
				d.fortunes.title, d.fortunes.note,
				this.fortunesCurrent, d.fortunes.options,
			),
			surplus: new SurplusSnapshot(
				d.surplus.title, d.surplus.note, this.surplusCurrent,
			),
			attributes: {
				size:       _attr("size",       d.attributes.size,       att.size?.current),
				population: _attr("population", d.attributes.population, att.population?.current),
				prosperity: _attr("prosperity", d.attributes.prosperity, att.prosperity?.current, att.prosperity?.extra ?? []),
				defenses:   _attr("defenses",   d.attributes.defenses,   att.defenses?.current,   att.defenses?.extra   ?? []),
			},
			debilities: d.debilities.map(def => new DebilitySnapshot(
				def.slug, def.description, def.note, deb[def.slug] ?? false,
			)),
			placesOfInterest: [
				...d.placesOfInterest.map(p => ({ ...p, isDefault: true,  extraIndex: null })),
				...this.extraPlaces.map((p, i) => ({ ...p, isDefault: false, extraIndex: i })),
			],
			notes:    this.notes,
			residents: this.residents,
			neighbors: this.neighbors,
			content: [
				new ContentSection("excluded",       "Excluded Content",  con.excluded       ?? []),
				new ContentSection("veiled",          "Veiled Content",   con.veiled         ?? []),
				new ContentSection("specialHandling", "Special Handling", con.specialHandling ?? []),
			],
			assets: {
				coinage: assets.coinage ?? d.assets.coinage,
			},
			improvements,
		});
	}
}

function _attr(key, def, savedCurrent, extraItems = []) {
	return new AttributeSnapshot(
		key, def.title, def.note,
		savedCurrent ?? def.current,
		def.options,
		def.resources ?? null,
		extraItems,
	);
}
