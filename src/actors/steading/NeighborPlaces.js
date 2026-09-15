import {NeighborPlace} from "./NeighborPlace.js";
import {SteadingDefaults} from "../../model/data/steading/SteadingDefaults.js";
import {withUnsetOption} from "../../model/snapshot/steading/SteadingSnapshot.js";

/**
 * The neighbouring places a steading keeps notes on, and that a steadfast defines.
 *
 * Composed by BOTH the typed steading and the typed steadfast, which is why the definitional
 * writers (`updateSize`) and the record ones (`updateTravel`) live side by side here: the list is
 * one shape, and each sheet decides which half of it that sheet lets you edit.
 */
export class NeighborPlaces {
	constructor(actor) {
		this._actor = actor;
	}

	get _list() {
		return (this._actor.system?.neighborPlaces ?? []).map(NeighborPlace.fromRaw);
	}

	async _save(list) {
		await this._actor.update({"system.neighborPlaces": list.map(place => ({...place}))});
	}

	/** The places, as entities. */
	all() {
		return this._list;
	}

	findBySlug(slug) {
		return this._list.find(place => place.slug === slug) ?? null;
	}

	/** Replaces the place with the same slug, leaving every other row as it stands. */
	async update(place) {
		await this._save(this._list.map(p => p.slug === place.slug ? place : p));
	}

	async updateNote(slug, note) {
		const place = this.findBySlug(slug);
		if (place) await this.update(place.withNote(note));
	}

	async updateNames(slug, names) {
		const place = this.findBySlug(slug);
		if (place) await this.update(place.withNames(names));
	}

	/** Definitional — authored on the steadfast, and kept in step there by migrateNeighborPlaces. */
	async updateSize(slug, size) {
		const place = this.findBySlug(slug);
		if (place) await this.update(place.withSize(size));
	}

	/** The record: how far this place is from the steading holding the list. */
	async updateTravel(slug, travel) {
		const place = this.findBySlug(slug);
		if (place) await this.update(place.withTravel(travel));
	}

	// Returns the (throwaway) NeighborPlace instances for rendering, each carrying the two render-only
	// readings of `size` its two sheets need: the word for it, and the options to pick it from.
	// Neither is persisted — `_save` maps fresh `_list` entities, not snapshot output.
	buildSnapshot() {
		const def = SteadingDefaults.attributes.size;
		return this._list.map(place => {
			place.sizeLabel   = def.tierLabel(place.size);
			place.sizeOptions = withUnsetOption(def.selectOptions(place.size));
			return place;
		});
	}
}
